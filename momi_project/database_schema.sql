-- MOMi Project Database Schema Update
-- Remove guest users and implement full registered user system

-- ============================================================================
-- 1. USER PROFILES TABLE (Enhanced user data beyond Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,

    -- Family Role (Multiple selection)
    family_roles TEXT[] DEFAULT '{}', -- ['hoping_to_become_mother', 'currently_pregnant', 'mom_young_children', etc.]

    -- Children Information
    children_count INTEGER DEFAULT 0,
    children_ages TEXT[] DEFAULT '{}', -- ['0-2', '3-5', '6-12', '13-18', '18+', 'expecting']

    -- Main Concerns/Goals (Multiple selection)
    main_concerns TEXT[] DEFAULT '{}', -- ['food', 'resilience', 'movement', 'community', 'spiritual', 'environment', 'abundance']
    main_concerns_other TEXT, -- Custom concern if "Other" is selected

    -- Dietary Preferences (Multiple selection)
    dietary_preferences TEXT[] DEFAULT '{}', -- ['gluten_free', 'dairy_free', 'nut_free', 'soy_free', 'vegetarian', 'vegan', 'no_preference']
    dietary_preferences_other TEXT, -- Custom preference if "Other" is selected

    -- Personalization Settings
    personalized_support BOOLEAN DEFAULT false,

    -- Raw registration data for admin viewing
    registration_metadata JSONB DEFAULT '{}',

    -- Chatbot memory and preferences
    chatbot_memory JSONB DEFAULT '{}', -- Store user-specific context and preferences

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. UPDATE CONVERSATIONS TABLE (Remove guest users)
-- ============================================================================
-- First, let's backup any existing guest data before dropping
CREATE TABLE IF NOT EXISTS conversations_backup AS
SELECT * FROM conversations WHERE guest_user_id IS NOT NULL;

-- Remove guest_user_id column and make user_id required
ALTER TABLE conversations
DROP COLUMN IF EXISTS guest_user_id,
ADD CONSTRAINT conversations_user_id_required CHECK (user_id IS NOT NULL);

-- Update the user_id to reference auth.users
ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_user_id_fkey,
ADD CONSTRAINT conversations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 3. DROP GUEST USERS TABLES (No longer needed)
-- ============================================================================
DROP TABLE IF EXISTS guest_users CASCADE;

-- ============================================================================
-- 4. UPDATE USERS TABLE (Link to auth.users and add profile reference)
-- ============================================================================
-- Update existing users table to link properly with auth and profiles
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- ============================================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_family_roles ON user_profiles USING GIN(family_roles);
CREATE INDEX IF NOT EXISTS idx_user_profiles_main_concerns ON user_profiles USING GIN(main_concerns);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see and modify their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Admins can see all profiles (you'll need to create admin role)
CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND (profile_data->>'role' = 'admin' OR email = 'admin@yourdomain.com')
        )
    );

-- Update conversations RLS
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 7. FUNCTIONS FOR USER MANAGEMENT
-- ============================================================================

-- Function to create user profile after auth signup
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

-- Trigger to automatically create profile when user signs up
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

-- ============================================================================
-- 8. ADMIN FUNCTIONS
-- ============================================================================

-- Function to get all registered users with their profiles
CREATE OR REPLACE FUNCTION get_all_registered_users()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    family_roles TEXT[],
    children_count INTEGER,
    children_ages TEXT[],
    main_concerns TEXT[],
    dietary_preferences TEXT[],
    personalized_support BOOLEAN,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    conversation_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        up.auth_user_id,
        up.email,
        up.first_name,
        up.last_name,
        up.family_roles,
        up.children_count,
        up.children_ages,
        up.main_concerns,
        up.dietary_preferences,
        up.personalized_support,
        up.created_at,
        au.last_sign_in_at,
        COALESCE(conv_count.count, 0) as conversation_count
    FROM user_profiles up
    LEFT JOIN auth.users au ON up.auth_user_id = au.id
    LEFT JOIN (
        SELECT user_id, COUNT(*) as count
        FROM conversations
        GROUP BY user_id
    ) conv_count ON up.auth_user_id = conv_count.user_id
    ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete user and all associated data
CREATE OR REPLACE FUNCTION delete_user_completely(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    conversation_ids UUID[];
BEGIN
    -- Get all conversation IDs for the user
    SELECT array_agg(id) INTO conversation_ids
    FROM conversations WHERE user_id = target_user_id;

    -- Delete messages for those conversations
    IF conversation_ids IS NOT NULL THEN
        DELETE FROM messages WHERE conversation_id = ANY(conversation_ids);
    END IF;

    -- Delete conversations
    DELETE FROM conversations WHERE user_id = target_user_id;

    -- Delete user profile
    DELETE FROM user_profiles WHERE auth_user_id = target_user_id;

    -- Delete from users table if exists
    DELETE FROM users WHERE auth_user_id = target_user_id;

    -- Delete auth user (this should cascade)
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error deleting user: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 9. SEED ADMIN USER (Update as needed)
-- ============================================================================

-- Create system settings for admin configuration
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
    ('admin_emails', '["admin@yourdomain.com"]', 'List of admin email addresses'),
    ('registration_enabled', 'true', 'Whether new user registration is enabled'),
    ('require_circle_membership', 'true', 'Whether to require Circle membership verification')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. This schema removes all guest user functionality
-- 2. All users must be registered through Supabase Auth
-- 3. User profiles are automatically created on signup
-- 4. RLS ensures users can only access their own data
-- 5. Admin functions provide complete user management
-- 6. All foreign keys cascade properly for data integrity
-- ============================================================================