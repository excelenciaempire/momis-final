import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// TEMPORARY DEBUGGING: Log the keys being used by the client
console.log("[supabaseClient.js] VITE_SUPABASE_URL:", supabaseUrl);
console.log("[supabaseClient.js] VITE_SUPABASE_ANON_KEY (first 10 chars):", supabaseAnonKey ? supabaseAnonKey.substring(0, 10) : "null_or_undefined");

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing for Admin Panel. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null; 