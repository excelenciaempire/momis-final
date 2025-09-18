-- MOMi Admin System Database Schema
-- Separate admin authentication and user management

-- ============================================================================
-- 1. ADMIN USERS TABLE (Separate from regular users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- We'll hash passwords server-side
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),

    -- Admin-specific fields
    permissions JSONB DEFAULT '{}', -- Granular permissions
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

-- ============================================================================
-- 2. ADMIN SESSIONS TABLE (Separate session management)
-- ============================================================================
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

-- ============================================================================
-- 3. ADMIN ACTIVITY LOG (Audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'login', 'logout', 'view_user', 'delete_user', etc.
    resource_type TEXT, -- 'user', 'conversation', 'message', etc.
    resource_id TEXT, -- ID of the affected resource
    details JSONB DEFAULT '{}', -- Additional action details
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. UPDATE EXISTING TABLES FOR ADMIN SEPARATION
-- ============================================================================

-- Add admin tracking to system_settings
ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS created_by_admin UUID REFERENCES admin_users(id),
ADD COLUMN IF NOT EXISTS updated_by_admin UUID REFERENCES admin_users(id);

-- Add admin tracking to knowledge base documents
ALTER TABLE knowledge_base_documents
ADD COLUMN IF NOT EXISTS uploaded_by_admin UUID REFERENCES admin_users(id);

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action ON admin_activity_log(action);

-- ============================================================================
-- 6. ADMIN FUNCTIONS
-- ============================================================================

-- Function to create admin session
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

    -- Log the login
    INSERT INTO admin_activity_log (admin_user_id, action, ip_address, user_agent)
    VALUES (p_admin_user_id, 'login', p_ip_address, p_user_agent);

    RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate admin session
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

-- Function to log admin activity
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

-- Function to get admin dashboard stats
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

-- ============================================================================
-- 7. CLEAN UP OLD SESSIONS FUNCTION
-- ============================================================================
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
-- 8. CREATE INITIAL ADMIN USER (Update credentials as needed)
-- ============================================================================

-- Insert initial admin user (password will be hashed by backend)
INSERT INTO admin_users (email, password_hash, full_name, role, permissions)
VALUES (
    'admin@yourdomain.com',
    'PLACEHOLDER_HASH', -- This will be replaced by backend with proper hash
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

-- ============================================================================
-- 9. SECURITY POLICIES (Admin tables don't use RLS since they're backend-only)
-- ============================================================================

-- These tables will be accessed only through backend API with proper authentication
-- No RLS needed as they won't be accessed directly from frontend

-- ============================================================================
-- 10. TRIGGERS
-- ============================================================================

-- Auto-update updated_at for admin_users
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Admin system is completely separate from user authentication
-- 2. Admin sessions are managed independently
-- 3. All admin actions are logged for audit trail
-- 4. Granular permissions system for different admin roles
-- 5. Session cleanup and security features included
-- 6. No RLS on admin tables - secured at application level
-- ============================================================================