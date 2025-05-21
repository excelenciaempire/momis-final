const { supabase } = require('../utils/supabaseClient'); // We'll create this shared client soon

// This middleware assumes you are setting a custom claim 'app_role' or similar
// in Supabase Auth for your users, e.g., via a trigger on user creation or manually.
// Alternatively, you could query a separate 'user_roles' table.

const authAdmin = async (req, res, next) => {
    // TEMPORARILY BYPASSING AUTH FOR PREVIEW
    console.log("Backend authAdmin middleware: Bypassing auth for preview.");
    next();
    return; // Ensure no other code in this function runs

    // Original logic:
    // const authHeader = req.headers.authorization;
    //
    // if (!authHeader || !authHeader.startsWith('Bearer ')) {
    //     return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    // }
    //
    // const token = authHeader.split(' ')[1];
    //
    // if (!token) {
    //     return res.status(401).json({ error: 'Unauthorized: Malformed token.' });
    // }
    //
    // try {
    //     const { data: { user }, error } = await supabase.auth.getUser(token);
    //
    //     if (error) {
    //         console.error("Error fetching user with token:", error.message);
    //         return res.status(401).json({ error: 'Unauthorized: Invalid token.', details: error.message });
    //     }
    //
    //     if (!user) {
    //         return res.status(401).json({ error: 'Unauthorized: User not found for token.' });
    //     }
    //
    //     // Check for admin role in app_metadata
    //     // Option 1: Direct app_metadata.role check (if you set it this way)
    //     // const isAdmin = user.app_metadata?.role === 'admin'; 
    //     
    //     // Option 2: Check an array of roles in app_metadata.roles
    //     const isAdmin = user.app_metadata?.roles && user.app_metadata.roles.includes('admin');
    //
    //     if (!isAdmin) {
    //         console.warn(`User ${user.email} (ID: ${user.id}) attempted to access admin route without admin role.`);
    //         return res.status(403).json({ error: 'Forbidden: User does not have admin privileges.' });
    //     }
    //
    //     req.user = user; // Attach user object to request for subsequent handlers
    //     next();
    // } catch (error) {
    //     console.error("Admin auth middleware error:", error);
    //     return res.status(500).json({ error: 'Internal server error during authentication.' });
    // }
};

module.exports = authAdmin; 