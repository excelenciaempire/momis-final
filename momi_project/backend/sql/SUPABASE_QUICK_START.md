# Quick Start: Supabase SQL Setup

## Option 1: Run Master Script (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the entire contents of `MASTER_KB_SETUP.sql`
5. Click **Run** (or press Ctrl+Enter)

You should see output like:
```
NOTICE: ✓ pgvector extension is installed
NOTICE: ✓ vector type is available
NOTICE: ✓ Vector index already exists on document_chunks table
NOTICE: ✓ match_document_chunks function exists
NOTICE: ✓ System settings updated
NOTICE: ✓ Knowledge Base analytics tables and functions created
NOTICE: ====================================
NOTICE: Knowledge Base Setup Complete!
```

## Option 2: Run Individual Scripts

If you prefer to run scripts one by one:

### 1. First, enable pgvector extension
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Then run each script in order:
- `ensure-vector-extension.sql`
- `update-momi-prompt.sql`
- `kb-analytics-table.sql`

## Troubleshooting

### Error: "pgvector extension is not installed"
1. Go to Database → Extensions in Supabase
2. Find "vector" in the list
3. Toggle it ON
4. Re-run the script

### Error: "permission denied"
Make sure you're logged in as an admin user in Supabase

### Success Indicators
- No red error messages
- Green "Success" notification
- NOTICE messages showing checkmarks (✓)

## What Happens Next?

After running the script:
1. Your KB system is ready
2. Go to your admin panel at `/admin`
3. Navigate to Knowledge → Manage Documents
4. Upload your first document
5. Check KB Settings to verify everything works

## Need Help?

Check the detailed setup guide in `KB_SETUP_INSTRUCTIONS.md` 