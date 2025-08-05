-- Simple fix for match_document_chunks function
-- Run this entire script at once

-- 1. Drop all possible versions
DROP FUNCTION IF EXISTS match_document_chunks CASCADE;
DROP FUNCTION IF EXISTS public.match_document_chunks CASCADE;

-- 2. Create the function fresh
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
    dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION match_document_chunks TO anon;
GRANT EXECUTE ON FUNCTION match_document_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks TO service_role;

-- 4. Quick test
SELECT 'Function created successfully!' as status; 