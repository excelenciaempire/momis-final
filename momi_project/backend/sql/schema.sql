-- Enable necessary extensions if not already enabled in Supabase dashboard
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (for registered users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL, -- Links to Supabase Auth users
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    profile_data JSONB -- For interests, preferences, etc.
);

-- Guest users table
CREATE TABLE IF NOT EXISTS guest_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    guest_user_id UUID REFERENCES guest_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    ended_at TIMESTAMPTZ,
    summary TEXT,
    CONSTRAINT user_or_guest_check CHECK (user_id IS NOT NULL OR guest_user_id IS NOT NULL)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'momi', 'system')),
    content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image_url', 'audio_url', 'hyperlink')),
    content TEXT NOT NULL,
    metadata JSONB, -- e.g., for image analysis results, audio transcription details
    openai_message_id TEXT, -- If applicable, for tracing
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Knowledge base documents table (for RAG)
CREATE TABLE IF NOT EXISTS knowledge_base_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- e.g., 'pdf', 'txt', 'md'
    content_text TEXT, -- Raw text content (can be large)
    uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_indexed_at TIMESTAMPTZ,
    metadata JSONB -- e.g., source, tags, original document structure
);

-- Document chunks table (for RAG embeddings)
-- Ensure pgvector extension is enabled and vector_size matches your embedding model (e.g., 1536 for text-embedding-ada-002)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge_base_documents(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding PUBLIC.VECTOR(1536), -- Adjust vector size if using a different model
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for efficient similarity search on embeddings
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding public.vector_l2_ops) WITH (lists = 100);
-- Or use HNSW for potentially better performance/recall trade-off:
-- CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING hnsw (embedding public.vector_l2_ops);


-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for system_settings
CREATE TRIGGER set_timestamp_system_settings
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Seed initial system settings (example)
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
    ('momi_base_prompt', 'You are MOMi, a friendly and empathetic assistant. Your goal is to support users, provide helpful information, and guide them towards well-being resources. Do not offer medical advice.', 'The main system prompt for MOMi's personality and instructions.')
ON CONFLICT (setting_key) DO NOTHING;

-- RLS (Row Level Security) Policies
-- It's CRITICAL to set up RLS policies for all tables to protect user data.
-- These are examples and need to be tailored to your exact needs.

-- For users table: Users can only see and manage their own data.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own data" ON users
    FOR ALL
    USING (auth.uid() = auth_user_id);

-- For guest_users table: Might be managed by backend service role.
-- Consider if guests need to access their own data via a session token mechanism.
ALTER TABLE guest_users ENABLE ROW LEVEL SECURITY;
-- Example: Backend service role can access all.
-- CREATE POLICY "Service role access for guest_users" ON guest_users FOR ALL USING (auth.role() = 'service_role');

-- For conversations table: Users can only see their own conversations.
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own conversations" ON conversations
    FOR ALL
    USING (
        (user_id IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE users.id = conversations.user_id AND users.auth_user_id = auth.uid())) OR
        (guest_user_id IS NOT NULL) -- Needs a secure way to link guest session to current request, potentially through backend logic.
                                    -- Or, make conversations involving guests only accessible via service_role.
    );
-- A more restrictive policy for guests if access is only through backend:
-- CREATE POLICY "Service role access for guest conversations" ON conversations FOR ALL USING (auth.role() = 'service_role' AND guest_user_id IS NOT NULL);

-- For messages table: Users can only see messages in their own conversations.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage messages in their own conversations" ON messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id AND
            (
                (c.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id AND u.auth_user_id = auth.uid())) OR
                (c.guest_user_id IS NOT NULL) -- Again, careful handling for guest access.
            )
        )
    );

-- knowledge_base_documents & document_chunks: Usually readable by all authenticated users, writable by admins/service_role.
ALTER TABLE knowledge_base_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KB documents are readable by authenticated users" ON knowledge_base_documents
    FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "KB documents are manageable by service_role or admins" ON knowledge_base_documents
    FOR ALL
    USING (auth.role() = 'service_role'); -- Consider an admin role check if admins manage through client

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "KB chunks are readable by authenticated users" ON document_chunks
    FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "KB chunks are manageable by service_role or admins" ON document_chunks
    FOR ALL
    USING (auth.role() = 'service_role');

-- system_settings: Readable by authenticated users, writable by admins/service_role.
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System settings readable by authenticated users" ON system_settings
    FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "System settings manageable by service_role or admins" ON system_settings
    FOR ALL
    USING (auth.role() = 'service_role'); -- Add admin check if needed.

-- Note: The RLS policies for guest users and their conversations/messages need careful consideration.
-- Typically, the backend, using a service_role key, would handle all operations related to guest data
-- based on a session token it manages, rather than allowing direct guest access via RLS with anon key. 