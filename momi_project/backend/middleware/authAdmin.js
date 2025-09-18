const crypto = require('crypto');
const { supabase } = require('../utils/supabaseClient');

// Helper function to extract IP address
const getClientIP = (req) => {
    return req.headers['x-forwarded-for'] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// Separate admin authentication middleware
const authAdmin = async (req, res, next) => {
    const sessionToken = req.headers['x-admin-session'] || req.cookies?.adminSession;
    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    if (!sessionToken) {
        return res.status(401).json({
            error: 'Unauthorized: No admin session token provided.',
            redirectTo: '/admin/login'
        });
    }

    try {
        // Validate admin session using our custom function
        const { data: adminData, error } = await supabase
            .rpc('validate_admin_session', { p_session_token: sessionToken });

        if (error || !adminData || adminData.length === 0) {
            console.error("Admin session validation error:", error);
            return res.status(401).json({
                error: 'Unauthorized: Invalid or expired admin session.',
                redirectTo: '/admin/login'
            });
        }

        const admin = adminData[0];

        // Attach admin info to request
        req.admin = {
            id: admin.admin_id,
            email: admin.email,
            fullName: admin.full_name,
            role: admin.role,
            permissions: admin.permissions,
            sessionToken: sessionToken
        };

        // Log the admin action (except for frequent actions like dashboard views)
        const skipLogging = ['/api/admin/analytics/summary', '/api/admin/dashboard/stats'];
        if (!skipLogging.some(path => req.path.includes(path))) {
            try {
                await supabase.rpc('log_admin_activity', {
                    p_admin_user_id: admin.admin_id,
                    p_action: `${req.method} ${req.path}`,
                    p_resource_type: extractResourceType(req.path),
                    p_resource_id: extractResourceId(req.path, req.params),
                    p_details: {
                        method: req.method,
                        path: req.path,
                        query: req.query,
                        timestamp: new Date().toISOString()
                    },
                    p_ip_address: clientIP,
                    p_user_agent: userAgent
                });
            } catch (logError) {
                console.error("Failed to log admin activity:", logError);
                // Don't fail the request if logging fails
            }
        }

        next();
    } catch (error) {
        console.error("Admin auth middleware error:", error);
        return res.status(500).json({
            error: 'Internal server error during admin authentication.',
            details: error.message
        });
    }
};

// Helper function to extract resource type from path
const extractResourceType = (path) => {
    if (path.includes('/users/')) return 'user';
    if (path.includes('/conversations/')) return 'conversation';
    if (path.includes('/messages/')) return 'message';
    if (path.includes('/knowledge-base/') || path.includes('/rag/')) return 'knowledge_base';
    if (path.includes('/system-settings/')) return 'system_settings';
    return 'general';
};

// Helper function to extract resource ID from path
const extractResourceId = (path, params) => {
    // Try to extract UUID from path or params
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const match = path.match(uuidRegex);
    if (match) return match[0];

    // Check params for common ID fields
    if (params.userId) return params.userId;
    if (params.conversationId) return params.conversationId;
    if (params.messageId) return params.messageId;
    if (params.documentId) return params.documentId;

    return null;
};

// Middleware to check specific permissions
const requirePermission = (resource, action) => {
    return (req, res, next) => {
        const adminPermissions = req.admin?.permissions;

        if (!adminPermissions || !adminPermissions[resource] || !adminPermissions[resource][action]) {
            return res.status(403).json({
                error: `Forbidden: Insufficient permissions for ${action} on ${resource}`,
                required: `${resource}.${action}`,
                current: adminPermissions
            });
        }

        next();
    };
};

module.exports = { authAdmin, requirePermission }; 