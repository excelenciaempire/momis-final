-- =====================================================
-- SIMPLIFIED MOMI KB SETUP - Run each section separately
-- =====================================================

-- SECTION 1: Enable pgvector
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- SECTION 2: Create/verify the match function
-- =====================================================
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  similarity float,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    dc.metadata
  FROM
    document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$$;

-- SECTION 3: Update system settings
-- =====================================================
UPDATE system_settings 
SET setting_value = 'You are MOMi, a warm, caring, and empathetic assistant dedicated to supporting families and individuals. Your personality is that of a trusted friend who genuinely cares about people''s well-being.

PERSONALITY TRAITS:
- Warm and approachable, using gentle language and emojis appropriately 😊
- Empathetic and understanding, acknowledging feelings before offering solutions
- Supportive without being overbearing
- Professional yet personable

KNOWLEDGE BASE INTEGRATION:
When you have access to information from uploaded documents in the knowledge base:
1. PRIORITIZE information from the knowledge base when answering questions
2. Seamlessly blend factual KB information with your caring personality
3. Reference specific details from documents when relevant
4. If KB contains an answer, use it as your primary source
5. Maintain accuracy while keeping your warm, supportive tone

RESPONSE GUIDELINES:
- Start with empathy when appropriate ("I understand this can be challenging...")
- Provide accurate information from the knowledge base when available
- Offer practical, actionable advice
- Use simple, clear language avoiding jargon
- Include relevant resources or next steps
- End with encouragement or an offer for further help

IMPORTANT BOUNDARIES:
- Never provide medical diagnoses or treatment advice
- Don''t make assumptions about personal situations
- Respect privacy and confidentiality
- Direct to professional help when appropriate

Remember: You''re here to inform, support, and empower. When knowledge base information is available, it should guide your responses while maintaining your caring, supportive demeanor.',
    updated_at = NOW()
WHERE setting_key = 'momi_base_prompt';

-- SECTION 4: Add KB configuration
-- =====================================================
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
    'kb_retrieval_config',
    '{"similarity_threshold": 0.78, "max_chunks": 5, "use_top_chunks": 3, "debug_mode": true}',
    'Configuration for Knowledge Base retrieval parameters'
) ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- SECTION 5: Enable analytics
-- =====================================================
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
    'kb_analytics_enabled',
    'true',
    'Enable analytics tracking for Knowledge Base usage'
) ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- SECTION 6: Create analytics table
-- =====================================================
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
    metadata JSONB
);

-- SECTION 7: Create indexes for analytics
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_kb_analytics_created_at ON kb_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_conversation ON kb_analytics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_similarity ON kb_analytics(avg_similarity DESC);

-- SECTION 8: Enable RLS on analytics
-- =====================================================
ALTER TABLE kb_analytics ENABLE ROW LEVEL SECURITY;

-- SECTION 9: Create analytics policies
-- =====================================================
CREATE POLICY "Service role full access to analytics" ON kb_analytics
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users read analytics" ON kb_analytics
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- SECTION 10: Create analytics functions
-- =====================================================
CREATE OR REPLACE FUNCTION track_kb_query(
    p_query_text TEXT,
    p_conversation_id UUID,
    p_chunks_found INTEGER,
    p_chunks_used INTEGER,
    p_avg_similarity FLOAT,
    p_sources TEXT[],
    p_embedding_time_ms INTEGER DEFAULT NULL,
    p_retrieval_time_ms INTEGER DEFAULT NULL,
    p_total_time_ms INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO kb_analytics (
        query_text,
        conversation_id,
        chunks_found,
        chunks_used,
        avg_similarity,
        sources,
        embedding_time_ms,
        retrieval_time_ms,
        total_time_ms,
        metadata
    ) VALUES (
        LEFT(p_query_text, 200),
        p_conversation_id,
        p_chunks_found,
        p_chunks_used,
        p_avg_similarity,
        p_sources,
        p_embedding_time_ms,
        p_retrieval_time_ms,
        p_total_time_ms,
        p_metadata
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- SECTION 11: Grant permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION track_kb_query TO service_role; 