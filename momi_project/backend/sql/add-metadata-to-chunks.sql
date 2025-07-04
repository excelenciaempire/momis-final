-- Add metadata column to document_chunks table for better traceability
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS metadata JSONB;
 
-- Add comment to explain the column
COMMENT ON COLUMN document_chunks.metadata IS 'Stores additional information like fileName, page number, chunk index for debugging and traceability'; 