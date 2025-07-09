-- Create Knowledge Base Analytics table for tracking usage and performance
CREATE TABLE IF NOT EXISTS kb_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT, -- Truncated for privacy
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    chunks_found INTEGER NOT NULL,
    chunks_used INTEGER NOT NULL,
    avg_similarity FLOAT NOT NULL,
    sources TEXT[], -- Array of file names used
    embedding_time_ms INTEGER,
    retrieval_time_ms INTEGER,
    total_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    metadata JSONB -- Additional data like user type, query type, etc.
);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_kb_analytics_created_at ON kb_analytics(created_at DESC);

-- Index for conversation tracking
CREATE INDEX IF NOT EXISTS idx_kb_analytics_conversation ON kb_analytics(conversation_id);

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_kb_analytics_similarity ON kb_analytics(avg_similarity DESC);

-- Enable RLS
ALTER TABLE kb_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access to analytics" ON kb_analytics
    FOR ALL
    USING (auth.role() = 'service_role');

-- Policy: Authenticated users can read aggregated data only
CREATE POLICY "Authenticated users read analytics" ON kb_analytics
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Function to get KB usage statistics
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

-- Function to track KB query (called from backend)
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
        LEFT(p_query_text, 200), -- Truncate for privacy
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_kb_usage_stats TO authenticated;
GRANT EXECUTE ON FUNCTION track_kb_query TO service_role; 