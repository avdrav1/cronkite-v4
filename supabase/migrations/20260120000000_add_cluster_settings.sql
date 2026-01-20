-- Add cluster configuration settings to user_settings table
ALTER TABLE user_settings
ADD COLUMN min_cluster_sources INTEGER NOT NULL DEFAULT 3,
ADD COLUMN min_cluster_articles INTEGER NOT NULL DEFAULT 3,
ADD COLUMN cluster_similarity_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.60,
ADD COLUMN keyword_overlap_min INTEGER NOT NULL DEFAULT 3,
ADD COLUMN cluster_time_window_hours INTEGER NOT NULL DEFAULT 48;

-- Add comments for documentation
COMMENT ON COLUMN user_settings.min_cluster_sources IS 'Minimum number of unique sources required for a cluster';
COMMENT ON COLUMN user_settings.min_cluster_articles IS 'Minimum number of articles required for a cluster';
COMMENT ON COLUMN user_settings.cluster_similarity_threshold IS 'Minimum cosine similarity threshold for clustering (0.0-1.0)';
COMMENT ON COLUMN user_settings.keyword_overlap_min IS 'Minimum number of shared keywords required between articles';
COMMENT ON COLUMN user_settings.cluster_time_window_hours IS 'Maximum time window in hours for articles in a cluster';
