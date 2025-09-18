-- ============================================================================
-- MOMi PROJECT - COMPLETE DATABASE UPGRADE
-- Execute this entire script in Supabase SQL Editor
-- ============================================================================

-- ⚠️  IMPORTANT: BACKUP YOUR DATABASE FIRST!
-- This script will:
-- 1. Create user profiles system for registration data
-- 2. Create separate admin authentication system
-- 3. Remove guest user functionality
-- 4. Set up Row Level Security
-- 5. Create automated functions and triggers

-- ============================================================================
-- PHASE 1: CREATE USER PROFILES SYSTEM
-- ============================================================================

-- Create user profiles table for extended registration data
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,

    -- Family Role (Multiple selection from registration form)
    family_roles TEXT[] DEFAULT '{}', -- ['hoping_to_become_mother', 'currently_pregnant', etc.]

    -- Children Information
    children_count INTEGER DEFAULT 0,
    children_ages TEXT[] DEFAULT '{}', -- ['0-2', '3-5', '6-12', '13-18', '18+', 'expecting']

    -- Main Concerns/Goals (7 Pillars of Wellness + Other)
    main_concerns TEXT[] DEFAULT '{}', -- ['food', 'resilience', 'movement', 'community', 'spiritual', 'environment', 'abundance']
    main_concerns_other TEXT, -- Custom concern if "Other" selected

    -- Dietary Preferences and Allergies
    dietary_preferences TEXT[] DEFAULT '{}', -- ['gluten_free', 'dairy_free', 'nut_free', etc.]
    dietary_preferences_other TEXT, -- Custom dietary info if "Other" selected

    -- Personalization Settings
    personalized_support BOOLEAN DEFAULT false, -- Yes/No for tailored recommendations

    -- Raw registration data for admin viewing
    registration_metadata JSONB DEFAULT '{}', -- Complete form submission data

    -- Chatbot memory and personalization context
    chatbot_memory JSONB DEFAULT '{}', -- Store conversation topics, preferences, etc.

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_family_roles ON user_profiles USING GIN(family_roles);
CREATE INDEX IF NOT EXISTS idx_user_profiles_main_concerns ON user_profiles USING GIN(main_concerns);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);

-- ============================================================================
-- PHASE 2: CREATE ADMIN AUTHENTICATION SYSTEM (SEPARATE FROM USERS)
-- ============================================================================

-- Admin users table (completely independent from regular user auth)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- bcrypt hashed passwords
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),

    -- Admin-specific fields
    permissions JSONB DEFAULT '{}', -- Granular permissions for different admin actions
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,

    -- Security fields
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ, -- Account locking for security
    password_reset_token TEXT,
    password_reset_expires TIMESTAMPTZ,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id)
);

-- Admin sessions table for secure session management
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin activity log for audit trail
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'login', 'view_user', 'delete_user', etc.
    resource_type TEXT, -- 'user', 'conversation', 'message', etc.
    resource_id TEXT, -- ID of affected resource
    details JSONB DEFAULT '{}', -- Additional action details
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin system indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action ON admin_activity_log(action);

-- ============================================================================
-- PHASE 3: UPDATE EXISTING TABLES (REMOVE GUEST FUNCTIONALITY)
-- ============================================================================

-- Backup existing guest data before removal
CREATE TABLE IF NOT EXISTS conversations_backup AS
SELECT * FROM conversations WHERE guest_user_id IS NOT NULL;

-- Remove guest_user_id column from conversations (keep only registered users)
ALTER TABLE conversations DROP COLUMN IF EXISTS guest_user_id;

-- Make user_id required for all conversations
DO $$
BEGIN
    -- Only add constraint if column allows nulls
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'user_id' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE conversations ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Update foreign key constraint to reference auth.users properly
ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_user_id_fkey,
ADD CONSTRAINT conversations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop guest_users table completely (no longer needed)
DROP TABLE IF EXISTS guest_users CASCADE;

-- Update existing users table to link with profiles
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Add admin tracking to system tables
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES admin_users(id),
ADD COLUMN IF NOT EXISTS updated_by_admin UUID REFERENCES admin_users(id);

ALTER TABLE knowledge_base_documents
ADD COLUMN IF NOT EXISTS uploaded_by_admin UUID REFERENCES admin_users(id);

-- Update indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- ============================================================================
-- PHASE 4: CREATE AUTOMATED DATABASE FUNCTIONS
-- ============================================================================

-- Function to automatically create user profile when user signs up
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (auth_user_id, email, first_name, last_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Admin session management function
CREATE OR REPLACE FUNCTION create_admin_session(
    p_admin_user_id UUID,
    p_session_token TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_expires_hours INTEGER DEFAULT 24
)
RETURNS UUID AS $$
DECLARE
    session_id UUID;
BEGIN
    -- Deactivate old sessions for this admin
    UPDATE admin_sessions
    SET is_active = false
    WHERE admin_user_id = p_admin_user_id AND is_active = true;

    -- Create new session
    INSERT INTO admin_sessions (
        admin_user_id,
        session_token,
        ip_address,
        user_agent,
        expires_at
    ) VALUES (
        p_admin_user_id,
        p_session_token,
        p_ip_address,
        p_user_agent,
        NOW() + (p_expires_hours || ' hours')::INTERVAL
    ) RETURNING id INTO session_id;

    -- Update admin login statistics
    UPDATE admin_users
    SET
        last_login_at = NOW(),
        login_count = login_count + 1,
        failed_login_attempts = 0
    WHERE id = p_admin_user_id;

    RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin session validation function
CREATE OR REPLACE FUNCTION validate_admin_session(p_session_token TEXT)
RETURNS TABLE(
    admin_id UUID,
    email TEXT,
    full_name TEXT,
    role TEXT,
    permissions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        au.id,
        au.email,
        au.full_name,
        au.role,
        au.permissions
    FROM admin_users au
    JOIN admin_sessions asess ON au.id = asess.admin_user_id
    WHERE asess.session_token = p_session_token
      AND asess.is_active = true
      AND asess.expires_at > NOW()
      AND au.is_active = true
      AND (au.locked_until IS NULL OR au.locked_until < NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin activity logging function
CREATE OR REPLACE FUNCTION log_admin_activity(
    p_admin_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id TEXT DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_activity_log (
        admin_user_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        user_agent
    ) VALUES (
        p_admin_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO log_id;

    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dashboard statistics function for admin panel
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_users', (SELECT COUNT(*) FROM user_profiles),
        'total_conversations', (SELECT COUNT(*) FROM conversations),
        'total_messages', (SELECT COUNT(*) FROM messages),
        'messages_today', (
            SELECT COUNT(*) FROM messages
            WHERE DATE(timestamp) = CURRENT_DATE
        ),
        'new_users_this_week', (
            SELECT COUNT(*) FROM user_profiles
            WHERE created_at >= NOW() - INTERVAL '7 days'
        ),
        'active_users_this_week', (
            SELECT COUNT(DISTINCT user_id) FROM conversations
            WHERE created_at >= NOW() - INTERVAL '7 days'
        ),
        'knowledge_base_documents', (SELECT COUNT(*) FROM knowledge_base_documents),
        'knowledge_base_chunks', (SELECT COUNT(*) FROM document_chunks)
    ) INTO stats;

    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_admin_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM admin_sessions
    WHERE expires_at < NOW() - INTERVAL '7 days'
    OR (is_active = false AND created_at < NOW() - INTERVAL '30 days');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 5: SET UP ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on user_profiles table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only access their own profile data
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Update conversations RLS policies
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Enable guest user conversations" ON conversations;

CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Note: Admin tables don't use RLS as they're accessed only through backend API

-- ============================================================================
-- PHASE 6: INSERT SYSTEM CONFIGURATION AND INITIAL ADMIN
-- ============================================================================

-- Update system settings for the new user management system
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
    ('admin_emails', '["admin@yourdomain.com"]', 'List of admin email addresses'),
    ('registration_enabled', 'true', 'Whether new user registration is enabled'),
    ('require_circle_membership', 'true', 'Whether to require Circle membership verification'),
    ('user_authentication_required', 'false', 'Whether to enforce user authentication (set to true when ready)')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- Create initial admin user (password will be set via backend API)
-- IMPORTANT: Use the /api/admin/auth/initialize endpoint to create your first admin
INSERT INTO admin_users (email, password_hash, full_name, role, permissions)
VALUES (
    'admin@yourdomain.com', -- CHANGE THIS EMAIL
    'PLACEHOLDER_HASH', -- This will be replaced by backend when you use initialization endpoint
    'System Administrator', -- CHANGE THIS NAME
    'super_admin',
    '{
        "users": {"view": true, "edit": true, "delete": true},
        "conversations": {"view": true, "delete": true},
        "knowledge_base": {"view": true, "upload": true, "delete": true},
        "system_settings": {"view": true, "edit": true},
        "analytics": {"view": true},
        "admin_management": {"view": true, "create": true, "edit": true}
    }'::jsonb
)
ON CONFLICT (email) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- ============================================================================
-- VERIFICATION QUERIES (RUN THESE AFTER EXECUTION TO VERIFY SUCCESS)
-- ============================================================================

-- Check that all tables were created
SELECT 'Tables Created' as status,
       COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_profiles',
    'admin_users',
    'admin_sessions',
    'admin_activity_log'
  );

-- Check that all functions were created
SELECT 'Functions Created' as status,
       COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_user_profile',
    'create_admin_session',
    'validate_admin_session',
    'log_admin_activity',
    'get_admin_dashboard_stats',
    'cleanup_expired_admin_sessions'
  );

-- Check RLS policies
SELECT 'RLS Policies' as status,
       COUNT(*) as count
FROM pg_policies
WHERE tablename IN ('user_profiles', 'conversations');

-- Check system settings
SELECT 'System Settings' as status,
       COUNT(*) as count
FROM system_settings
WHERE setting_key IN (
    'admin_emails',
    'registration_enabled',
    'require_circle_membership',
    'user_authentication_required'
);

-- ============================================================================
-- 🎉 DATABASE UPGRADE COMPLETE!
-- ============================================================================

-- Next steps after running this SQL:
-- 1. Use POST /api/admin/auth/initialize to create your first real admin user
-- 2. Deploy the registration frontend to start accepting user registrations
-- 3. Set 'user_authentication_required' to 'true' when ready to enforce authentication
-- 4. Test the complete flow: registration → login → personalized chat → admin management

-- Your MOMi system now supports:
-- ✅ Complete user registration with 7-section form
-- ✅ Separate admin authentication system
-- ✅ Profile-aware chatbot responses
-- ✅ Comprehensive admin dashboard
-- ✅ Secure data management with RLS
-- ✅ Full audit trail for compliance