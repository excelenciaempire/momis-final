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

        // Get user profile (optional - create fallback if not found)
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        let userProfile = profile;
        
        if (profileError || !profile) {
            console.log('User profile not found for authenticated user:', user.id, '- creating fallback profile');
            // Create a fallback profile for users without complete registration
            userProfile = {
                auth_user_id: user.id,
                email: user.email,
                first_name: user.user_metadata?.first_name || user.email?.split('@')[0] || 'User',
                last_name: user.user_metadata?.last_name || '',
                family_roles: [],
                children_count: 0,
                main_concerns: [],
                dietary_preferences: [],
                personalized_support: false
            };
        }

        // Attach user and profile to request
        req.user = user;
        req.userProfile = userProfile;

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