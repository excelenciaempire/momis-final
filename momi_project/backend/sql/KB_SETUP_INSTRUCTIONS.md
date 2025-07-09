# Knowledge Base Setup Instructions

This guide will help you implement all the Knowledge Base improvements for your MOMI chatbot.

## Overview

The improvements include:
1. Ensuring pgvector extension is enabled
2. Updating MOMI's system prompt for better KB integration  
3. Enhanced logging and debugging
4. KB health check endpoints
5. Configurable retrieval parameters
6. Analytics tracking

## Database Setup

Run these SQL scripts in your Supabase SQL editor in this order:

### 1. Ensure Vector Extension (Required)
```sql
-- Run: ensure-vector-extension.sql
```
This verifies pgvector is installed and creates necessary indexes.

### 2. Update MOMI System Prompt
```sql
-- Run: update-momi-prompt.sql
```
This updates the system prompt and adds configuration settings.

### 3. Create Analytics Table (Optional but Recommended)
```sql
-- Run: kb-analytics-table.sql
```
This creates tables and functions for tracking KB usage.

## Backend Updates

The backend code has been updated with:
- Dynamic configuration loading from database
- Enhanced debug logging with emojis
- Performance timing metrics
- Analytics tracking
- Health check endpoints
- Test query endpoint

No additional deployment steps needed - just deploy the updated code.

## Admin Panel Updates

A new "KB Settings" page has been added to the admin panel that allows you to:
- Adjust similarity threshold (0.5-0.95)
- Configure number of chunks to retrieve
- Enable/disable debug mode
- Run health checks
- Test queries against the KB

Access it at: `/admin/knowledge/kb-settings`

## Testing Your Knowledge Base

### 1. Run Health Check
```bash
curl -X GET https://your-domain.com/api/admin/kb/health-check \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "pgvector": { "status": "ok" },
    "documents": { "status": "ok", "count": 5 },
    "chunks": { "status": "ok", "count": 127 },
    "embeddings": { "status": "ok" },
    "similarity_search": { "status": "ok" }
  }
}
```

### 2. Test a Query
```bash
curl -X POST https://your-domain.com/api/admin/kb/test-query \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I handle stress?"}'
```

### 3. Enable Debug Mode
In the admin panel KB Settings, enable debug mode to see detailed logs in your server console.

## Configuration Options

Default configuration (adjustable in admin panel):
- **Similarity Threshold**: 0.78 (lower = more results)
- **Max Chunks**: 5 (chunks retrieved from DB)
- **Use Top Chunks**: 3 (chunks used in context)
- **Debug Mode**: false

## Monitoring Performance

With debug mode enabled, you'll see logs like:
```
🔍 Knowledge Base Retrieval Debug:
   Query: "How do I handle stress?"
   Embedding time: 125ms
   Retrieval time: 45ms
   Chunks found: 5
   Similarity threshold: 0.78

📚 Knowledge Base Chunks Analysis:
   Total chunks found: 5
   Using top 3 chunks
   Similarity range: 0.9234 - 0.7812

📄 Selected Chunks:
   1. stress-management-guide.pdf
      - Similarity: 0.9234 🟢
      - Chunk: 3/15
      - Size: 1487 chars
```

## Troubleshooting

### Issue: "pgvector not functional"
**Solution**: Enable pgvector extension in Supabase dashboard under Database > Extensions

### Issue: No chunks returned
**Solutions**:
1. Check if documents are uploaded and indexed
2. Lower similarity threshold (try 0.7)
3. Verify embeddings are being generated

### Issue: Slow retrieval
**Solutions**:
1. Check if vector index exists
2. Consider reducing max_chunks
3. Monitor embedding generation time

### Issue: Analytics not tracking
**Solution**: Run the kb-analytics-table.sql script

## Best Practices

1. **Document Quality**: Upload clear, well-structured documents
2. **Chunk Size**: Current setting (1500 chars) works well for most content
3. **Similarity Threshold**: Start at 0.78, adjust based on results
4. **Regular Monitoring**: Check health status weekly
5. **Debug Sparingly**: Only enable debug mode when troubleshooting

## Next Steps

1. Upload your knowledge base documents
2. Run a health check to verify setup
3. Test with sample queries
4. Adjust configuration based on results
5. Monitor analytics for usage patterns

For support, check the server logs or contact your system administrator. 