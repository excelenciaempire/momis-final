-- =====================================================
-- FIX KB FUNCTION - Complete cleanup and recreation
-- =====================================================

-- Step 1: Drop ALL existing versions of the function
DO $$
BEGIN
    -- Drop any function with this name regardless of parameters
    DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int);
    DROP FUNCTION IF EXISTS match_document_chunks(public.vector, float, int);
    DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), float, int);
    DROP FUNCTION IF EXISTS match_document_chunks(public.vector(1536), float, int);
    DROP FUNCTION IF EXISTS public.match_document_chunks(vector, float, int);
    DROP FUNCTION IF EXISTS public.match_document_chunks(public.vector, float, int);
    DROP FUNCTION IF EXISTS public.match_document_chunks(vector(1536), float, int);
    DROP FUNCTION IF EXISTS public.match_document_chunks(public.vector(1536), float, int);
    
    RAISE NOTICE 'Dropped all existing versions of match_document_chunks';
END $$;

-- Step 2: Create the function with explicit schema qualification
CREATE OR REPLACE FUNCTION public.match_document_chunks (
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
    public.document_chunks dc
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$$;

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector(1536), float, int) TO anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector(1536), float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector(1536), float, int) TO service_role;

-- Step 4: Verify the function was created
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc
    WHERE proname = 'match_document_chunks';
    
    IF func_count = 1 THEN
        RAISE NOTICE '✓ Function created successfully (1 version exists)';
    ELSIF func_count > 1 THEN
        RAISE WARNING '⚠ Multiple versions found (%). This might cause issues.', func_count;
    ELSE
        RAISE EXCEPTION '✗ Function not created!';
    END IF;
END $$;

-- Step 5: Test the function with a simple query
DO $$
BEGIN
    -- This should not fail if the function is working
    PERFORM * FROM public.match_document_chunks(
        ARRAY_FILL(0::float, ARRAY[1536])::vector(1536),
        0.1,
        1
    );
    RAISE NOTICE '✓ Function test passed';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '✗ Function test failed: %', SQLERRM;
END $$; 