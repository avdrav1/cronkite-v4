-- Add article_ids column to clusters table
-- This stores article IDs directly in the cluster for efficient retrieval

ALTER TABLE clusters 
ADD COLUMN IF NOT EXISTS article_ids TEXT[] DEFAULT '{}';

-- Add comment explaining the column
COMMENT ON COLUMN clusters.article_ids IS 'Array of article IDs belonging to this cluster, stored directly for efficient retrieval';
