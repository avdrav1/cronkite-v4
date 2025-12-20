-- Initial seed data for Cronkite database
-- This file is run after migrations during database reset

-- Verify pgvector extension is enabled
SELECT 'pgvector extension status:' as info, extname, extversion 
FROM pg_extension 
WHERE extname = 'vector';

-- Create a comment to indicate successful seed execution
COMMENT ON SCHEMA public IS 'Cronkite database schema initialized with pgvector support';