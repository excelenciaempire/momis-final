-- Find and drop ALL versions of match_document_chunks
-- Run this ENTIRE script at once

-- First, let's see what we have
DO $$
DECLARE
    func_record RECORD;
    drop_command TEXT;
BEGIN
    -- Loop through all functions named match_document_chunks
    FOR func_record IN 
        SELECT 
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'match_document_chunks'
    LOOP
        -- Build the DROP command
        drop_command := format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
            func_record.schema_name,
            func_record.function_name,
            func_record.arguments
        );
        
        -- Execute the DROP command
        EXECUTE drop_command;
        RAISE NOTICE 'Dropped: %.%(%)', func_record.schema_name, func_record.function_name, func_record.arguments;
    END LOOP;
    
    RAISE NOTICE 'All versions of match_document_chunks have been dropped';
END $$;

-- Now create a clean version
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION match_document_chunks(vector(1536), float, int) TO anon;
GRANT EXECUTE ON FUNCTION match_document_chunks(vector(1536), float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks(vector(1536), float, int) TO service_role;

-- Verify we have exactly one function now
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc
    WHERE proname = 'match_document_chunks';
    
    RAISE NOTICE 'Number of match_document_chunks functions: %', func_count;
    
    IF func_count = 1 THEN
        RAISE NOTICE '✓ Success! Exactly one function exists';
    ELSE
        RAISE WARNING '⚠ Warning: % functions found', func_count;
    END IF;
END $$;

SELECT 'Function cleanup and creation complete!' as status; 