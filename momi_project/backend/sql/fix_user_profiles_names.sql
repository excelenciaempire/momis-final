-- Fix User Profiles: Ensure first_name and last_name are populated correctly
-- This script updates the trigger and migrates existing users with empty names

-- ============================================================================
-- PART 1: Update the create_user_profile function to better handle metadata
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name TEXT;
    v_last_name TEXT;
BEGIN
    -- Extract first_name and last_name from metadata
    v_first_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''), '');
    v_last_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''), '');
    
    -- Only insert if profile doesn't exist (in case of race conditions)
    INSERT INTO public.user_profiles (
        auth_user_id, 
        email, 
        first_name, 
        last_name,
        family_roles,
        children_count,
        children_ages,
        main_concerns,
        main_concerns_other,
        dietary_preferences,
        dietary_preferences_other,
        personalized_support,
        registration_metadata
    )
    VALUES (
        NEW.id,
        NEW.email,
        v_first_name,
        v_last_name,
        -- Extract arrays from metadata
        CASE 
            WHEN jsonb_typeof(NEW.raw_user_meta_data->'family_roles') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'family_roles'))
            ELSE '{}'::TEXT[]
        END,
        COALESCE((NEW.raw_user_meta_data->>'children_count')::INTEGER, 0),
        CASE 
            WHEN jsonb_typeof(NEW.raw_user_meta_data->'children_ages') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'children_ages'))
            ELSE '{}'::TEXT[]
        END,
        CASE 
            WHEN jsonb_typeof(NEW.raw_user_meta_data->'main_concerns') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'main_concerns'))
            ELSE '{}'::TEXT[]
        END,
        NEW.raw_user_meta_data->>'main_concerns_other',
        CASE 
            WHEN jsonb_typeof(NEW.raw_user_meta_data->'dietary_preferences') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'dietary_preferences'))
            ELSE '{}'::TEXT[]
        END,
        NEW.raw_user_meta_data->>'dietary_preferences_other',
        COALESCE((NEW.raw_user_meta_data->>'personalized_support')::BOOLEAN, false),
        jsonb_build_object(
            'registration_date', NEW.created_at,
            'registration_source', 'auth_trigger',
            'raw_metadata', NEW.raw_user_meta_data
        )
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = CASE 
            WHEN EXCLUDED.first_name != '' THEN EXCLUDED.first_name 
            ELSE public.user_profiles.first_name 
        END,
        last_name = CASE 
            WHEN EXCLUDED.last_name != '' THEN EXCLUDED.last_name 
            ELSE public.user_profiles.last_name 
        END,
        family_roles = CASE 
            WHEN array_length(EXCLUDED.family_roles, 1) > 0 THEN EXCLUDED.family_roles 
            ELSE public.user_profiles.family_roles 
        END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 2: Recreate the trigger
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- ============================================================================
-- PART 3: Migrate existing users with empty names from auth.users metadata
-- ============================================================================

-- Update profiles that have empty first_name or last_name
UPDATE public.user_profiles up
SET 
    first_name = COALESCE(
        NULLIF(TRIM(up.first_name), ''),
        NULLIF(TRIM(au.raw_user_meta_data->>'first_name'), ''),
        ''
    ),
    last_name = COALESCE(
        NULLIF(TRIM(up.last_name), ''),
        NULLIF(TRIM(au.raw_user_meta_data->>'last_name'), ''),
        ''
    ),
    updated_at = NOW()
FROM auth.users au
WHERE up.auth_user_id = au.id
  AND (
    TRIM(COALESCE(up.first_name, '')) = '' 
    OR TRIM(COALESCE(up.last_name, '')) = ''
  )
  AND (
    TRIM(COALESCE(au.raw_user_meta_data->>'first_name', '')) != ''
    OR TRIM(COALESCE(au.raw_user_meta_data->>'last_name', '')) != ''
  );

-- ============================================================================
-- PART 4: Report on users that still have empty names
-- ============================================================================

SELECT 
    up.id as profile_id,
    up.auth_user_id,
    up.email,
    up.first_name,
    up.last_name,
    au.raw_user_meta_data->>'first_name' as metadata_first_name,
    au.raw_user_meta_data->>'last_name' as metadata_last_name,
    up.created_at
FROM public.user_profiles up
LEFT JOIN auth.users au ON up.auth_user_id = au.id
WHERE 
    TRIM(COALESCE(up.first_name, '')) = '' 
    OR TRIM(COALESCE(up.last_name, '')) = ''
ORDER BY up.created_at DESC;

