# 🗄️ **Database Execution Guide - Complete MOMi System Setup**

## ⚠️ **IMPORTANT: Read Before Executing**

This guide will help you execute the database changes to complete your MOMi system. **Please backup your database first!**

---

## 📋 **Pre-Execution Checklist**

### ✅ **Step 1: Backup Current Database**
1. Go to Supabase Dashboard → Your Project → Settings → Database
2. Create a backup or export current schema
3. Note down any critical guest user data you want to preserve

### ✅ **Step 2: Access Supabase SQL Editor**
1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Create a new query

---

## 🚀 **Database Migration Steps**

### **Phase 1: Create User Profile System**

Copy and paste this SQL into Supabase SQL Editor:

```sql
-- ============================================================================
-- PHASE 1: USER PROFILES SYSTEM
-- ============================================================================

-- Create user profiles table for extended user data
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,

    -- Family Role (Multiple selection)
    family_roles TEXT[] DEFAULT '{}',

    -- Children Information
    children_count INTEGER DEFAULT 0,
    children_ages TEXT[] DEFAULT '{}',

    -- Main Concerns/Goals (Multiple selection)
    main_concerns TEXT[] DEFAULT '{}',
    main_concerns_other TEXT,

    -- Dietary Preferences (Multiple selection)
    dietary_preferences TEXT[] DEFAULT '{}',
    dietary_preferences_other TEXT,

    -- Personalization Settings
    personalized_support BOOLEAN DEFAULT false,

    -- Raw registration data for admin viewing
    registration_metadata JSONB DEFAULT '{}',

    -- Chatbot memory and preferences
    chatbot_memory JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_family_roles ON user_profiles USING GIN(family_roles);
CREATE INDEX IF NOT EXISTS idx_user_profiles_main_concerns ON user_profiles USING GIN(main_concerns);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at);
```

**Click "RUN" to execute Phase 1**

---

### **Phase 2: Create Admin Authentication System**

```sql
-- ============================================================================
-- PHASE 2: ADMIN AUTHENTICATION SYSTEM
-- ============================================================================

-- Admin users table (separate from regular users)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),

    -- Admin-specific fields
    permissions JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,

    -- Security fields
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMPTZ,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id)
);

-- Admin sessions table
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

-- Admin activity log
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action ON admin_activity_log(action);
```

**Click "RUN" to execute Phase 2**

---

### **Phase 3: Update Existing Tables**

```sql
-- ============================================================================
-- PHASE 3: UPDATE EXISTING TABLES
-- ============================================================================

-- First, backup guest user data
CREATE TABLE IF NOT EXISTS conversations_backup AS
SELECT * FROM conversations WHERE guest_user_id IS NOT NULL;

-- Update conversations table - remove guest_user_id
ALTER TABLE conversations DROP COLUMN IF EXISTS guest_user_id;

-- Make user_id required in conversations
ALTER TABLE conversations
ALTER COLUMN user_id SET NOT NULL;

-- Update foreign key constraint
ALTER TABLE conversations
DROP CONSTRAINT IF EXISTS conversations_user_id_fkey,
ADD CONSTRAINT conversations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop guest_users table
DROP TABLE IF EXISTS guest_users CASCADE;

-- Update users table if it exists
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Update system_settings for admin tracking
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES admin_users(id),
ADD COLUMN IF NOT EXISTS updated_by_admin UUID REFERENCES admin_users(id);

-- Update knowledge_base_documents for admin tracking
ALTER TABLE knowledge_base_documents
ADD COLUMN IF NOT EXISTS uploaded_by_admin UUID REFERENCES admin_users(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
```

**Click "RUN" to execute Phase 3**

---

### **Phase 4: Create Database Functions**

```sql
-- ============================================================================
-- PHASE 4: DATABASE FUNCTIONS
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

    -- Update admin login info
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
```

**Click "RUN" to execute Phase 4**

---

### **Phase 5: Set Row Level Security (RLS)**

```sql
-- ============================================================================
-- PHASE 5: ROW LEVEL SECURITY
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

-- Update conversations RLS
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin tables don't use RLS (backend-only access)
```

**Click "RUN" to execute Phase 5**

---

### **Phase 6: Create Initial Admin User**

```sql
-- ============================================================================
-- PHASE 6: CREATE INITIAL ADMIN USER
-- ============================================================================

-- Insert system settings
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
    ('admin_emails', '["admin@yourdomain.com"]', 'List of admin email addresses'),
    ('registration_enabled', 'true', 'Whether new user registration is enabled'),
    ('require_circle_membership', 'true', 'Whether to require Circle membership verification')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- Create placeholder admin user (password will be set via backend)
INSERT INTO admin_users (email, password_hash, full_name, role, permissions)
VALUES (
    'admin@yourdomain.com',
    'PLACEHOLDER_HASH', -- Replace this via backend
    'System Administrator',
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
```

**Click "RUN" to execute Phase 6**

---

## ✅ **Verification Steps**

After executing all phases, verify the setup:

### **Check Tables Created:**
```sql
-- Run this to verify all tables exist:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user_profiles',
    'admin_users',
    'admin_sessions',
    'admin_activity_log'
  );
```

### **Check Functions Created:**
```sql
-- Run this to verify functions exist:
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'create_user_profile',
    'create_admin_session',
    'validate_admin_session',
    'log_admin_activity'
  );
```

### **Check RLS Policies:**
```sql
-- Run this to verify RLS policies:
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('user_profiles', 'conversations');
```

---

## 🚨 **If Something Goes Wrong**

### **Rollback Plan:**
1. **Restore from backup** if you made one
2. **Drop new tables:**
   ```sql
   DROP TABLE IF EXISTS admin_activity_log CASCADE;
   DROP TABLE IF EXISTS admin_sessions CASCADE;
   DROP TABLE IF EXISTS admin_users CASCADE;
   DROP TABLE IF EXISTS user_profiles CASCADE;
   ```
3. **Restore guest_users table** from backup if needed

### **Common Issues:**
- **Foreign key constraints:** Make sure auth.users table exists
- **RLS errors:** Check if policies conflict with existing ones
- **Function errors:** Verify plpgsql extension is enabled

---

## 🎉 **Success Confirmation**

When all phases complete successfully, you'll have:
- ✅ Complete user profile system
- ✅ Separate admin authentication
- ✅ Enhanced security with RLS
- ✅ Database functions for automation
- ✅ Ready for the new frontend apps

**Next step:** Deploy the frontend applications and updated backend!