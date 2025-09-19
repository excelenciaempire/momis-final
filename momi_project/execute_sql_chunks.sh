#!/bin/bash

PROJECT_REF="qohvdyqsulzzdtvavpgz"
ACCESS_TOKEN="sbp_fa4c22af9f7c8181486d9d1453afd98422f135fa"
API_URL="https://api.supabase.com/v1/projects/$PROJECT_REF/database/query"

execute_sql() {
    local sql="$1"
    local description="$2"
    echo "Executing: $description"

    response=$(curl -s -X POST "$API_URL" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"$sql\"}")

    if [[ "$response" == "[]" ]]; then
        echo "✅ Success: $description"
    else
        echo "❌ Error: $description"
        echo "Response: $response"
    fi
    echo "---"
}

# Execute SQL chunks
execute_sql "CREATE TABLE IF NOT EXISTS guest_users (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), session_token TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT now() NOT NULL, last_active_at TIMESTAMPTZ DEFAULT now() NOT NULL);" "Create guest_users table"

execute_sql "CREATE TABLE IF NOT EXISTS conversations (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL, guest_user_id UUID REFERENCES guest_users(id) ON DELETE SET NULL, title TEXT, created_at TIMESTAMPTZ DEFAULT now() NOT NULL, ended_at TIMESTAMPTZ, summary TEXT, CONSTRAINT user_or_guest_check CHECK (user_id IS NOT NULL OR guest_user_id IS NOT NULL));" "Create conversations table"

execute_sql "CREATE TABLE IF NOT EXISTS messages (id BIGSERIAL PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'momi', 'system')), content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image_url', 'audio_url', 'hyperlink')), content TEXT NOT NULL, metadata JSONB DEFAULT '{}', openai_message_id TEXT, timestamp TIMESTAMPTZ DEFAULT now() NOT NULL);" "Create messages table"

execute_sql "CREATE TABLE IF NOT EXISTS knowledge_base_documents (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), file_name TEXT NOT NULL, file_type TEXT NOT NULL, content_text TEXT, uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL, last_indexed_at TIMESTAMPTZ, metadata JSONB DEFAULT '{}');" "Create knowledge_base_documents table"

execute_sql "CREATE TABLE IF NOT EXISTS document_chunks (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), document_id UUID NOT NULL REFERENCES knowledge_base_documents(id) ON DELETE CASCADE, chunk_text TEXT NOT NULL, embedding PUBLIC.VECTOR(1536), metadata JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT now() NOT NULL);" "Create document_chunks table"

execute_sql "CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding public.vector_l2_ops) WITH (lists = 100);" "Create vector search index"

execute_sql "CREATE TABLE IF NOT EXISTS admin_users (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT NOT NULL, role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')), permissions JSONB DEFAULT '{}', last_login_at TIMESTAMPTZ, login_count INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT true, failed_login_attempts INTEGER DEFAULT 0, locked_until TIMESTAMPTZ, password_reset_token TEXT, password_reset_expires TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), created_by UUID REFERENCES admin_users(id), updated_at TIMESTAMPTZ DEFAULT NOW(), updated_by UUID REFERENCES admin_users(id));" "Create admin_users table"

execute_sql "CREATE TABLE IF NOT EXISTS admin_sessions (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE NOT NULL, session_token TEXT UNIQUE NOT NULL, ip_address INET, user_agent TEXT, expires_at TIMESTAMPTZ NOT NULL, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());" "Create admin_sessions table"

execute_sql "CREATE TABLE IF NOT EXISTS admin_activity_log (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL, action TEXT NOT NULL, resource_type TEXT, resource_id TEXT, details JSONB DEFAULT '{}', ip_address INET, user_agent TEXT, created_at TIMESTAMPTZ DEFAULT NOW());" "Create admin_activity_log table"

execute_sql "CREATE TABLE IF NOT EXISTS system_settings (id SERIAL PRIMARY KEY, setting_key TEXT UNIQUE NOT NULL, setting_value TEXT NOT NULL, description TEXT, created_at TIMESTAMPTZ DEFAULT now() NOT NULL, updated_at TIMESTAMPTZ DEFAULT now() NOT NULL, created_by_admin UUID REFERENCES admin_users(id), updated_by_admin UUID REFERENCES admin_users(id));" "Create system_settings table"

execute_sql "CREATE TABLE IF NOT EXISTS kb_analytics (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), query_text TEXT, conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL, chunks_found INTEGER NOT NULL, chunks_used INTEGER NOT NULL, avg_similarity FLOAT NOT NULL, sources TEXT[], embedding_time_ms INTEGER, retrieval_time_ms INTEGER, total_time_ms INTEGER, created_at TIMESTAMPTZ DEFAULT now() NOT NULL, metadata JSONB DEFAULT '{}');" "Create kb_analytics table"

echo "All tables created successfully! Creating indexes..."

# Create indexes
execute_sql "CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_user_id ON user_profiles(auth_user_id); CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);" "Create user_profiles indexes"

execute_sql "CREATE INDEX IF NOT EXISTS idx_guest_users_session_token ON guest_users(session_token); CREATE INDEX IF NOT EXISTS idx_guest_users_last_active ON guest_users(last_active_at);" "Create guest_users indexes"

execute_sql "CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id); CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);" "Create conversations indexes"

execute_sql "CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id); CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);" "Create messages indexes"

execute_sql "CREATE INDEX IF NOT EXISTS idx_knowledge_base_documents_uploaded_at ON knowledge_base_documents(uploaded_at DESC); CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);" "Create knowledge base indexes"

execute_sql "CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email); CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active); CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token); CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user ON admin_sessions(admin_user_id); CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at); CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user ON admin_activity_log(admin_user_id); CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at);" "Create admin system indexes"

execute_sql "CREATE INDEX IF NOT EXISTS idx_kb_analytics_created_at ON kb_analytics(created_at DESC); CREATE INDEX IF NOT EXISTS idx_kb_analytics_conversation ON kb_analytics(conversation_id); CREATE INDEX IF NOT EXISTS idx_kb_analytics_similarity ON kb_analytics(avg_similarity DESC);" "Create analytics indexes"

echo "🎉 Database setup complete!"