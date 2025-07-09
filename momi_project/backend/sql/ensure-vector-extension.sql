-- Ensure pgvector extension is enabled for vector similarity search
-- This is critical for the Knowledge Base RAG functionality

-- Create extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is installed
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension is not installed. Please enable it in Supabase dashboard under Database > Extensions';
    END IF;
END $$;

-- Verify vector type is available
DO $$
BEGIN
    PERFORM 'vector(1536)'::regtype;
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
        
        RAISE NOTICE 'Created vector index on document_chunks table';
    ELSE
        RAISE NOTICE 'Vector index already exists on document_chunks table';
    END IF;
END $$;

-- Verify the match_document_chunks function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'match_document_chunks'
    ) THEN
        RAISE EXCEPTION 'match_document_chunks function not found. Please run match_document_chunks.sql';
    ELSE
        RAISE NOTICE 'match_document_chunks function is properly installed';
    END IF;
END $$;

-- Output success message
SELECT 'pgvector extension and Knowledge Base infrastructure verified successfully' as status; 