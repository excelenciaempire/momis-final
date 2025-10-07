-- ============================================================================
-- FIX USER PROFILE SYNCHRONIZATION
-- Este script corrige la sincronización entre auth.users y user_profiles
-- ============================================================================

-- PASO 1: Recrear la función de creación de perfil con TODOS los campos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_registration()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insertar o actualizar el perfil del usuario con TODOS los datos del registro
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
        registration_metadata,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        -- Convertir arrays de JSON a TEXT[]
        COALESCE(
            CASE 
                WHEN jsonb_typeof(NEW.raw_user_meta_data->'family_roles') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'family_roles'))
                ELSE '{}'::TEXT[]
            END,
            '{}'::TEXT[]
        ),
        COALESCE((NEW.raw_user_meta_data->>'children_count')::INTEGER, 0),
        COALESCE(
            CASE 
                WHEN jsonb_typeof(NEW.raw_user_meta_data->'children_ages') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'children_ages'))
                ELSE '{}'::TEXT[]
            END,
            '{}'::TEXT[]
        ),
        COALESCE(
            CASE 
                WHEN jsonb_typeof(NEW.raw_user_meta_data->'main_concerns') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'main_concerns'))
                ELSE '{}'::TEXT[]
            END,
            '{}'::TEXT[]
        ),
        NEW.raw_user_meta_data->>'main_concerns_other',
        COALESCE(
            CASE 
                WHEN jsonb_typeof(NEW.raw_user_meta_data->'dietary_preferences') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'dietary_preferences'))
                ELSE '{}'::TEXT[]
            END,
            '{}'::TEXT[]
        ),
        NEW.raw_user_meta_data->>'dietary_preferences_other',
        COALESCE((NEW.raw_user_meta_data->>'personalized_support')::BOOLEAN, false),
        NEW.raw_user_meta_data,
        NOW(),
        NOW()
    )
    ON CONFLICT (auth_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        family_roles = EXCLUDED.family_roles,
        children_count = EXCLUDED.children_count,
        children_ages = EXCLUDED.children_ages,
        main_concerns = EXCLUDED.main_concerns,
        main_concerns_other = EXCLUDED.main_concerns_other,
        dietary_preferences = EXCLUDED.dietary_preferences,
        dietary_preferences_other = EXCLUDED.dietary_preferences_other,
        personalized_support = EXCLUDED.personalized_support,
        registration_metadata = EXCLUDED.registration_metadata,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

-- PASO 2: Recrear el trigger
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_registration();

-- PASO 3: Migrar usuarios existentes que tienen datos vacíos
-- ============================================================================

-- Actualizar perfiles existentes con datos de auth.users
UPDATE public.user_profiles up
SET 
    first_name = COALESCE(au.raw_user_meta_data->>'first_name', up.first_name, ''),
    last_name = COALESCE(au.raw_user_meta_data->>'last_name', up.last_name, ''),
    family_roles = COALESCE(
        CASE 
            WHEN jsonb_typeof(au.raw_user_meta_data->'family_roles') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(au.raw_user_meta_data->'family_roles'))
            ELSE up.family_roles
        END,
        up.family_roles
    ),
    children_count = COALESCE(
        (au.raw_user_meta_data->>'children_count')::INTEGER,
        up.children_count
    ),
    children_ages = COALESCE(
        CASE 
            WHEN jsonb_typeof(au.raw_user_meta_data->'children_ages') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(au.raw_user_meta_data->'children_ages'))
            ELSE up.children_ages
        END,
        up.children_ages
    ),
    main_concerns = COALESCE(
        CASE 
            WHEN jsonb_typeof(au.raw_user_meta_data->'main_concerns') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(au.raw_user_meta_data->'main_concerns'))
            ELSE up.main_concerns
        END,
        up.main_concerns
    ),
    main_concerns_other = COALESCE(
        au.raw_user_meta_data->>'main_concerns_other',
        up.main_concerns_other
    ),
    dietary_preferences = COALESCE(
        CASE 
            WHEN jsonb_typeof(au.raw_user_meta_data->'dietary_preferences') = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text(au.raw_user_meta_data->'dietary_preferences'))
            ELSE up.dietary_preferences
        END,
        up.dietary_preferences
    ),
    dietary_preferences_other = COALESCE(
        au.raw_user_meta_data->>'dietary_preferences_other',
        up.dietary_preferences_other
    ),
    personalized_support = COALESCE(
        (au.raw_user_meta_data->>'personalized_support')::BOOLEAN,
        up.personalized_support
    ),
    registration_metadata = COALESCE(au.raw_user_meta_data, up.registration_metadata, '{}'::jsonb),
    updated_at = NOW()
FROM auth.users au
WHERE up.auth_user_id = au.id
AND (
    up.family_roles = '{}' OR
    up.children_count = 0 OR
    up.main_concerns = '{}' OR
    up.dietary_preferences = '{}'
)
AND au.raw_user_meta_data IS NOT NULL
AND au.raw_user_meta_data != '{}'::jsonb;

-- PASO 4: Verificar resultados
-- ============================================================================

SELECT 
    'Total users' as metric,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'Users with profiles' as metric,
    COUNT(*) as count
FROM user_profiles
UNION ALL
SELECT 
    'Profiles with family roles' as metric,
    COUNT(*) as count
FROM user_profiles
WHERE array_length(family_roles, 1) > 0
UNION ALL
SELECT 
    'Profiles with dietary preferences' as metric,
    COUNT(*) as count
FROM user_profiles
WHERE array_length(dietary_preferences, 1) > 0
UNION ALL
SELECT 
    'Profiles with main concerns' as metric,
    COUNT(*) as count
FROM user_profiles
WHERE array_length(main_concerns, 1) > 0;

-- ============================================================================
-- NOTAS DE EJECUCIÓN:
-- ============================================================================
-- 1. Ejecutar este script completo en el SQL Editor de Supabase
-- 2. Verificar los resultados de la última query
-- 3. Si hay usuarios sin perfiles, verificar auth.users.raw_user_meta_data
-- 4. El trigger ahora procesará correctamente los nuevos registros
-- ============================================================================

