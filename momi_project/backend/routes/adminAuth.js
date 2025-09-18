const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { supabase } = require('../utils/supabaseClient');

const router = express.Router();

// Helper function to hash password
const hashPassword = async (password) => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
};

// Helper function to verify password
const verifyPassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

// Helper function to generate secure session token
const generateSessionToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Helper function to get client IP
const getClientIP = (req) => {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// Admin login route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required.'
        });
    }

    try {
        // Get admin user by email
        const { data: adminUsers, error: fetchError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('is_active', true)
            .single();

        if (fetchError || !adminUsers) {
            // Increment failed login attempts for this IP
            console.warn(`Failed admin login attempt for email: ${email} from IP: ${clientIP}`);
            return res.status(401).json({
                error: 'Invalid email or password.'
            });
        }

        const admin = adminUsers;

        // Check if account is locked
        if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
            return res.status(423).json({
                error: 'Account is temporarily locked due to multiple failed login attempts.',
                lockedUntil: admin.locked_until
            });
        }

        // Verify password
        const passwordValid = await verifyPassword(password, admin.password_hash);

        if (!passwordValid) {
            // Increment failed login attempts
            const newFailedAttempts = (admin.failed_login_attempts || 0) + 1;
            const lockAccount = newFailedAttempts >= 5;

            await supabase
                .from('admin_users')
                .update({
                    failed_login_attempts: newFailedAttempts,
                    locked_until: lockAccount ? new Date(Date.now() + 30 * 60 * 1000) : null // 30 minutes
                })
                .eq('id', admin.id);

            console.warn(`Failed admin login attempt ${newFailedAttempts} for: ${email} from IP: ${clientIP}`);

            return res.status(401).json({
                error: 'Invalid email or password.',
                ...(lockAccount && { warning: 'Account will be locked after 5 failed attempts.' })
            });
        }

        // Generate session token
        const sessionToken = generateSessionToken();

        // Create admin session
        const { data: sessionData, error: sessionError } = await supabase
            .rpc('create_admin_session', {
                p_admin_user_id: admin.id,
                p_session_token: sessionToken,
                p_ip_address: clientIP,
                p_user_agent: userAgent,
                p_expires_hours: 24
            });

        if (sessionError) {
            console.error('Error creating admin session:', sessionError);
            return res.status(500).json({
                error: 'Failed to create session.'
            });
        }

        // Set secure cookie
        res.cookie('adminSession', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Return success with admin info (no sensitive data)
        res.json({
            success: true,
            admin: {
                id: admin.id,
                email: admin.email,
                fullName: admin.full_name,
                role: admin.role,
                permissions: admin.permissions,
                lastLogin: admin.last_login_at
            },
            sessionToken: sessionToken, // For header-based auth if needed
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            error: 'Internal server error during login.',
            details: error.message
        });
    }
});

// Admin logout route
router.post('/logout', async (req, res) => {
    const sessionToken = req.headers['x-admin-session'] || req.cookies?.adminSession;

    if (sessionToken) {
        try {
            // Deactivate the session
            await supabase
                .from('admin_sessions')
                .update({ is_active: false })
                .eq('session_token', sessionToken);
        } catch (error) {
            console.error('Error during logout:', error);
        }
    }

    // Clear cookie
    res.clearCookie('adminSession');

    res.json({
        success: true,
        message: 'Logged out successfully.'
    });
});

// Verify session route
router.get('/verify', async (req, res) => {
    const sessionToken = req.headers['x-admin-session'] || req.cookies?.adminSession;

    if (!sessionToken) {
        return res.status(401).json({
            valid: false,
            error: 'No session token provided.'
        });
    }

    try {
        const { data: adminData, error } = await supabase
            .rpc('validate_admin_session', { p_session_token: sessionToken });

        if (error || !adminData || adminData.length === 0) {
            return res.status(401).json({
                valid: false,
                error: 'Invalid or expired session.'
            });
        }

        const admin = adminData[0];

        res.json({
            valid: true,
            admin: {
                id: admin.admin_id,
                email: admin.email,
                fullName: admin.full_name,
                role: admin.role,
                permissions: admin.permissions
            }
        });

    } catch (error) {
        console.error('Session verification error:', error);
        res.status(500).json({
            valid: false,
            error: 'Internal server error during verification.'
        });
    }
});

// Change password route (requires current session)
router.post('/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const sessionToken = req.headers['x-admin-session'] || req.cookies?.adminSession;

    if (!sessionToken) {
        return res.status(401).json({
            error: 'No active session.'
        });
    }

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            error: 'Current password and new password are required.'
        });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({
            error: 'New password must be at least 8 characters long.'
        });
    }

    try {
        // Validate session and get admin
        const { data: adminData, error: sessionError } = await supabase
            .rpc('validate_admin_session', { p_session_token: sessionToken });

        if (sessionError || !adminData || adminData.length === 0) {
            return res.status(401).json({
                error: 'Invalid session.'
            });
        }

        const adminId = adminData[0].admin_id;

        // Get current admin data
        const { data: admin, error: fetchError } = await supabase
            .from('admin_users')
            .select('password_hash')
            .eq('id', adminId)
            .single();

        if (fetchError || !admin) {
            return res.status(404).json({
                error: 'Admin user not found.'
            });
        }

        // Verify current password
        const currentPasswordValid = await verifyPassword(currentPassword, admin.password_hash);

        if (!currentPasswordValid) {
            return res.status(401).json({
                error: 'Current password is incorrect.'
            });
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update password
        const { error: updateError } = await supabase
            .from('admin_users')
            .update({
                password_hash: newPasswordHash,
                updated_at: new Date().toISOString(),
                updated_by: adminId
            })
            .eq('id', adminId);

        if (updateError) {
            console.error('Error updating password:', updateError);
            return res.status(500).json({
                error: 'Failed to update password.'
            });
        }

        // Log the password change
        await supabase.rpc('log_admin_activity', {
            p_admin_user_id: adminId,
            p_action: 'password_change',
            p_details: { timestamp: new Date().toISOString() }
        });

        res.json({
            success: true,
            message: 'Password changed successfully.'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            error: 'Internal server error during password change.',
            details: error.message
        });
    }
});

// Initialize admin route (for first-time setup)
router.post('/initialize', async (req, res) => {
    const { email, password, fullName, initKey } = req.body;

    // Check if initialization key matches (set in environment)
    if (initKey !== process.env.ADMIN_INIT_KEY) {
        return res.status(403).json({
            error: 'Invalid initialization key.'
        });
    }

    try {
        // Check if any admin users already exist
        const { count, error: countError } = await supabase
            .from('admin_users')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('Error checking admin count:', countError);
            return res.status(500).json({
                error: 'Failed to check existing admins.'
            });
        }

        if (count > 0) {
            return res.status(409).json({
                error: 'Admin system has already been initialized.'
            });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create initial admin user
        const { data: admin, error: createError } = await supabase
            .from('admin_users')
            .insert([{
                email: email.toLowerCase(),
                password_hash: passwordHash,
                full_name: fullName,
                role: 'super_admin',
                permissions: {
                    users: { view: true, edit: true, delete: true },
                    conversations: { view: true, delete: true },
                    knowledge_base: { view: true, upload: true, delete: true },
                    system_settings: { view: true, edit: true },
                    analytics: { view: true },
                    admin_management: { view: true, create: true, edit: true }
                }
            }])
            .select()
            .single();

        if (createError) {
            console.error('Error creating initial admin:', createError);
            return res.status(500).json({
                error: 'Failed to create initial admin user.'
            });
        }

        res.json({
            success: true,
            message: 'Admin system initialized successfully.',
            admin: {
                id: admin.id,
                email: admin.email,
                fullName: admin.full_name,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Admin initialization error:', error);
        res.status(500).json({
            error: 'Internal server error during initialization.',
            details: error.message
        });
    }
});

module.exports = router;