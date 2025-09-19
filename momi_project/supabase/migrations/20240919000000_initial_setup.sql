-- ===============================================================================
-- MOMI PROJECT - SETUP COMPLETO DE SUPABASE
-- ===============================================================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto de Supabase → SQL Editor
-- 2. Copia y pega TODO este script
-- 3. Haz clic en "Run" para ejecutar
-- 4. Verifica que no hay errores en la consola
-- ===============================================================================

-- PASO 1: Habilitar extensiones necesarias
-- ===============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Verificar que vector está disponible
DO $$
BEGIN
    PERFORM 'vector(1536)'::regtype;
    RAISE NOTICE '✅ Extensión vector habilitada correctamente';
EXCEPTION
    WHEN undefined_object THEN
        RAISE EXCEPTION '❌ Error: Extensión vector no disponible. Ve a Database → Extensions y habilita "vector"';
END $$;

-- PASO 2: Crear tablas principales del sistema
-- ===============================================================================

-- Tabla de perfiles de usuario detallados
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    family_roles TEXT[] NOT NULL DEFAULT '{}',
    children_count INTEGER DEFAULT 0,
    children_ages TEXT[] DEFAULT '{}',
    main_concerns TEXT[] DEFAULT '{}',
    main_concerns_other TEXT,
    dietary_preferences TEXT[] DEFAULT '{}',
    dietary_preferences_other TEXT,
    personalized_support BOOLEAN DEFAULT false,
    registration_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabla de usuarios invitados (para sesiones temporales)
CREATE TABLE IF NOT EXISTS guest_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    guest_user_id UUID REFERENCES guest_users(id) ON DELETE SET NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    ended_at TIMESTAMPTZ,
    summary TEXT,
    CONSTRAINT user_or_guest_check CHECK (user_id IS NOT NULL OR guest_user_id IS NOT NULL)
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'momi', 'system')),
    content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image_url', 'audio_url', 'hyperlink')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    openai_message_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- PASO 3: Crear tablas para Knowledge Base (RAG)
-- ===============================================================================

-- Tabla de documentos de la base de conocimiento
CREATE TABLE IF NOT EXISTS knowledge_base_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    content_text TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_indexed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Tabla de chunks de documentos para embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge_base_documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding PUBLIC.VECTOR(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Crear índice para búsqueda vectorial eficiente
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
ON document_chunks
USING ivfflat (embedding public.vector_l2_ops)
WITH (lists = 100);

-- PASO 4: Crear sistema de administración
-- ===============================================================================

-- Tabla de usuarios administradores
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    permissions JSONB DEFAULT '{}',
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id)
);

-- Tabla de sesiones de administradores
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

-- Tabla de registro de actividad de administradores
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

-- PASO 5: Crear tabla de configuración del sistema
-- ===============================================================================

-- Tabla de configuraciones del sistema
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_by_admin UUID REFERENCES admin_users(id),
    updated_by_admin UUID REFERENCES admin_users(id)
);

-- PASO 6: Crear tabla de analytics de Knowledge Base
-- ===============================================================================

-- Tabla de analytics para Knowledge Base
CREATE TABLE IF NOT EXISTS kb_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    chunks_found INTEGER NOT NULL,
    chunks_used INTEGER NOT NULL,
    avg_similarity FLOAT NOT NULL,
    sources TEXT[],
    embedding_time_ms INTEGER,
    retrieval_time_ms INTEGER,
    total_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- PASO 7: Crear índices para optimización
-- ===============================================================================

-- Índices para user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Índices para guest_users
CREATE INDEX IF NOT EXISTS idx_guest_users_session_token ON guest_users(session_token);
CREATE INDEX IF NOT EXISTS idx_guest_users_last_active ON guest_users(last_active_at);

-- Índices para conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
-- CREATE INDEX IF NOT EXISTS idx_conversations_guest_user_id ON conversations(guest_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- Índices para messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

-- Índices para knowledge base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_documents_uploaded_at ON knowledge_base_documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- Índices para admin system
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at);

-- Índices para KB analytics
CREATE INDEX IF NOT EXISTS idx_kb_analytics_created_at ON kb_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_conversation ON kb_analytics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_similarity ON kb_analytics(avg_similarity DESC);