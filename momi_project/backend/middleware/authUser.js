const { supabase } = require('../utils/supabaseClient');

// Middleware to authenticate regular users (not admins)
const authUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized: No token provided.',
            redirectTo: '/login'
        });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Unauthorized: Malformed token.',
            redirectTo: '/login'
        });
    }

    try {
        // Verify token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error) {
            console.error("Error fetching user with token:", error.message);
            return res.status(401).json({
                error: 'Unauthorized: Invalid token.',
                redirectTo: '/login'
            });
        }

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized: User not found for token.',
                redirectTo: '/login'
            });
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        if (profileError || !profile) {
            console.error('User profile not found for authenticated user:', user.id);
            return res.status(404).json({
                error: 'User profile not found. Please complete registration.',
                redirectTo: '/register'
            });
        }

        // Attach user and profile to request
        req.user = user;
        req.userProfile = profile;

        next();
    } catch (error) {
        console.error("User auth middleware error:", error);
        return res.status(500).json({
            error: 'Internal server error during authentication.',
            redirectTo: '/login'
        });
    }
};

module.exports = authUser;