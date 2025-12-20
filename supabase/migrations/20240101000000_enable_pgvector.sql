-- Enable the pgvector extension for semantic search capabilities
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify the extension is available
SELECT * FROM pg_extension WHERE extname = 'vector';