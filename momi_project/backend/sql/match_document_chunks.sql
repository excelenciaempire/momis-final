-- Ensure pgvector extension is enabled in Supabase (Database > Extensions)
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding public.vector(1536), -- Type and dimension must match your embeddings
  match_threshold float,          -- Similarity threshold (e.g., 0.7 to 0.8)
  match_count int                 -- Max number of chunks to return
)
RETURNS TABLE (             -- Defines the columns of the returned table
  id UUID,
  document_id UUID,
  chunk_text TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding) AS similarity -- Cosine distance (1 - cosine_similarity)
                                                      -- pgvector returns distance, so 1 - distance for similarity
  FROM
    document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC -- dc.embedding <=> query_embedding ASC for distance
  LIMIT match_count;
END;
$$; 