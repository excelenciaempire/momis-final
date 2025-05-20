require('dotenv').config(); // Ensure environment variables are loaded
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// For backend operations, especially auth checks and admin tasks, 
// using the service_role key is often necessary and appropriate.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("CRITICAL: Supabase URL or Service Key is missing for backend utils client. Most operations will fail.");
}

// Initialize a single Supabase client instance for backend use
// This client will have service_role privileges if SUPABASE_SERVICE_KEY is set.
const supabase = createClient(supabaseUrl, supabaseServiceKey || 'anon_key_fallback_if_service_not_set_but_should_not_happen_for_admin_ops');

module.exports = { supabase }; 