-- Add missing columns to clusters table for vector-based clustering
-- Requirements: 2.1, 2.7 - Vector-based clustering with relevance scores

-- Add avg_similarity column for tracking cluster cohesion
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS avg_similarity TEXT;

-- Add relevance_score column (article_count × source_diversity)
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS relevance_score TEXT;

-- Add generation_method column to track how cluster was created
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS generation_method TEXT DEFAULT 'vector';

-- Create index on relevance_score for efficient sorting
CREATE INDEX IF NOT EXISTS idx_clusters_relevance_score ON clusters(relevance_score DESC NULLS LAST);

-- Create index on expires_at for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_clusters_expires_at ON clusters(expires_at);

-- Create index on generation_method for filtering
CREATE INDEX IF NOT EXISTS idx_clusters_generation_method ON clusters(generation_method);
