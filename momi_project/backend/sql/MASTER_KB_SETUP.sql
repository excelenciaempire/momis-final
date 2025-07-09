-- =====================================================
-- MOMI KNOWLEDGE BASE MASTER SETUP SCRIPT
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- STEP 1: Ensure pgvector extension is enabled
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is installed
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension is not installed. Please enable it in Supabase dashboard under Database > Extensions';
    ELSE
        RAISE NOTICE '✓ pgvector extension is installed';
    END IF;
END $$;

-- Verify vector type is available
DO $$
BEGIN
    PERFORM 'vector(1536)'::regtype;
    RAISE NOTICE '✓ vector type is available';
EXCEPTION
    WHEN undefined_object THEN
        RAISE EXCEPTION 'vector type is not available. Please ensure pgvector extension is properly installed';
END $$;

-- Check if the index exists and create if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'document_chunks' 
        AND indexname = 'idx_document_chunks_embedding'
    ) THEN
        -- Create the index for efficient similarity search
        CREATE INDEX idx_document_chunks_embedding 
        ON document_chunks 
        USING ivfflat (embedding vector_l2_ops) 
        WITH (lists = 100);
        
        RAISE NOTICE '✓ Created vector index on document_chunks table';
    ELSE
        RAISE NOTICE '✓ Vector index already exists on document_chunks table';
    END IF;
END $$;

-- Verify the match_document_chunks function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'match_document_chunks'
    ) THEN
        RAISE NOTICE '⚠ match_document_chunks function not found. Creating it now...';
        
        -- Create the function
        CREATE OR REPLACE FUNCTION match_document_chunks (
          query_embedding public.vector(1536),
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
        
        RAISE NOTICE '✓ Created match_document_chunks function';
    ELSE
        RAISE NOTICE '✓ match_document_chunks function exists';
    END IF;
END $$;

-- STEP 2: Update MOMI System Prompt and Configuration
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

-- Add KB retrieval configuration
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
    'kb_retrieval_config',
    '{"similarity_threshold": 0.78, "max_chunks": 5, "use_top_chunks": 3, "debug_mode": true}',
    'Configuration for Knowledge Base retrieval parameters'
) ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- Add KB analytics setting
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
    'kb_analytics_enabled',
    'true',
    'Enable analytics tracking for Knowledge Base usage'
) ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

RAISE NOTICE '✓ System settings updated';

-- STEP 3: Create Knowledge Base Analytics Table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_kb_analytics_created_at ON kb_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_conversation ON kb_analytics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_kb_analytics_similarity ON kb_analytics(avg_similarity DESC);

-- Enable RLS
ALTER TABLE kb_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'kb_analytics' 
        AND policyname = 'Service role full access to analytics'
    ) THEN
        CREATE POLICY "Service role full access to analytics" ON kb_analytics
            FOR ALL
            USING (auth.role() = 'service_role');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'kb_analytics' 
        AND policyname = 'Authenticated users read analytics'
    ) THEN
        CREATE POLICY "Authenticated users read analytics" ON kb_analytics
            FOR SELECT
            USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Create analytics functions
CREATE OR REPLACE FUNCTION get_kb_usage_stats(
    days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_queries BIGINT,
    avg_chunks_found NUMERIC,
    avg_chunks_used NUMERIC,
    avg_similarity NUMERIC,
    avg_response_time_ms NUMERIC,
    top_sources TEXT[],
    queries_per_day JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) as total,
            AVG(chunks_found)::NUMERIC(10,2) as avg_found,
            AVG(chunks_used)::NUMERIC(10,2) as avg_used,
            AVG(avg_similarity)::NUMERIC(10,4) as avg_sim,
            AVG(total_time_ms)::NUMERIC(10,2) as avg_time,
            ARRAY_AGG(DISTINCT source ORDER BY source) as all_sources
        FROM kb_analytics, 
             LATERAL unnest(sources) as source
        WHERE created_at >= NOW() - INTERVAL '1 day' * days_back
    ),
    daily_stats AS (
        SELECT 
            DATE(created_at) as day,
            COUNT(*) as count
        FROM kb_analytics
        WHERE created_at >= NOW() - INTERVAL '1 day' * days_back
        GROUP BY DATE(created_at)
        ORDER BY day DESC
    )
    SELECT 
        stats.total,
        stats.avg_found,
        stats.avg_used,
        stats.avg_sim,
        stats.avg_time,
        (SELECT ARRAY(SELECT unnest(stats.all_sources) as s GROUP BY s ORDER BY COUNT(*) DESC LIMIT 10)),
        (SELECT jsonb_object_agg(day::text, count) FROM daily_stats);
END;
$$;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_kb_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION track_kb_query TO service_role;

RAISE NOTICE '✓ Knowledge Base analytics tables and functions created';

-- STEP 4: Final Verification
-- =====================================================
DO $$
DECLARE
    v_doc_count INTEGER;
    v_chunk_count INTEGER;
BEGIN
    -- Check document count
    SELECT COUNT(*) INTO v_doc_count FROM knowledge_base_documents;
    SELECT COUNT(*) INTO v_chunk_count FROM document_chunks;
    
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Knowledge Base Setup Complete!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Status Summary:';
    RAISE NOTICE '✓ pgvector extension: READY';
    RAISE NOTICE '✓ Vector index: CREATED';
    RAISE NOTICE '✓ Search function: READY';
    RAISE NOTICE '✓ System prompt: UPDATED';
    RAISE NOTICE '✓ KB configuration: SET';
    RAISE NOTICE '✓ Analytics: ENABLED';
    RAISE NOTICE '';
    RAISE NOTICE 'Current Statistics:';
    RAISE NOTICE '- Documents: % uploaded', v_doc_count;
    RAISE NOTICE '- Chunks: % indexed', v_chunk_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Upload documents via admin panel';
    RAISE NOTICE '2. Run health check in KB Settings';
    RAISE NOTICE '3. Test with sample queries';
    RAISE NOTICE '====================================';
END $$; 