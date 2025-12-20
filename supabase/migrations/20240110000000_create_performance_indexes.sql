-- Create comprehensive performance indexes for database optimization
-- Task 10.1: Add indexes on foreign keys and frequently queried fields
-- Create composite indexes for common query patterns
-- Add partial indexes for filtered queries (active feeds, unread articles)
-- Optimize for feed synchronization and user reading patterns

-- ============================================================================
-- FOREIGN KEY INDEXES (ensure all foreign keys have indexes)
-- ============================================================================

-- User management foreign key indexes (most already exist, adding missing ones)
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id_fk ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id_fk ON user_interests(user_id);

-- Feed management foreign key indexes
CREATE INDEX IF NOT EXISTS idx_folders_user_id_fk ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_feeds_user_id_fk ON feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_feeds_folder_id_fk ON feeds(folder_id);

-- Article storage foreign key indexes
CREATE INDEX IF NOT EXISTS idx_articles_feed_id_fk ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_cluster_id_fk ON articles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_user_articles_user_id_fk ON user_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_articles_article_id_fk ON user_articles(article_id);

-- AI and tracking foreign key indexes
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id_fk ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_history_user_id_fk ON digest_history(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_sync_log_feed_id_fk ON feed_sync_log(feed_id);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- User reading patterns - most common queries
CREATE INDEX IF NOT EXISTS idx_user_articles_user_read_status ON user_articles(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_user_articles_user_starred ON user_articles(user_id, is_starred);
CREATE INDEX IF NOT EXISTS idx_user_articles_user_read_starred ON user_articles(user_id, is_read, is_starred);

-- Feed and article browsing patterns
CREATE INDEX IF NOT EXISTS idx_articles_feed_published ON articles(feed_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_feed_fetched ON articles(feed_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_user_status ON feeds(user_id, status);
CREATE INDEX IF NOT EXISTS idx_feeds_user_folder ON feeds(user_id, folder_id);

-- Folder organization patterns
CREATE INDEX IF NOT EXISTS idx_folders_user_position ON folders(user_id, position);
CREATE INDEX IF NOT EXISTS idx_feeds_folder_position ON feeds(folder_id, created_at) WHERE folder_id IS NOT NULL;

-- Time-based article queries (for feed views and reading lists)
CREATE INDEX IF NOT EXISTS idx_articles_published_feed ON articles(published_at DESC, feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_fetched_feed ON articles(fetched_at DESC, feed_id);

-- User article interaction patterns
CREATE INDEX IF NOT EXISTS idx_user_articles_read_time ON user_articles(user_id, read_at DESC) WHERE read_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_articles_starred_time ON user_articles(user_id, starred_at DESC) WHERE starred_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_articles_clicked_time ON user_articles(user_id, clicked_at DESC) WHERE clicked_at IS NOT NULL;

-- AI usage tracking patterns
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_digest_history_user_sent ON digest_history(user_id, sent_at DESC);

-- Feed synchronization patterns
CREATE INDEX IF NOT EXISTS idx_feed_sync_log_feed_started ON feed_sync_log(feed_id, sync_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_sync_log_status_started ON feed_sync_log(status, sync_started_at DESC);

-- ============================================================================
-- PARTIAL INDEXES FOR FILTERED QUERIES
-- ============================================================================

-- Active feeds only (most common filter)
CREATE INDEX IF NOT EXISTS idx_feeds_active_user ON feeds(user_id, last_fetched_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_feeds_active_priority ON feeds(user_id, priority, last_fetched_at DESC) WHERE status = 'active';

-- Unread articles (very common query pattern)
CREATE INDEX IF NOT EXISTS idx_user_articles_unread ON user_articles(user_id, article_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_user_articles_unread_time ON user_articles(user_id, created_at DESC) WHERE is_read = false;

-- Starred articles (important for user bookmarks)
CREATE INDEX IF NOT EXISTS idx_user_articles_starred_only ON user_articles(user_id, starred_at DESC) WHERE is_starred = true;

-- Error feeds (for monitoring and troubleshooting)
CREATE INDEX IF NOT EXISTS idx_feeds_error_user ON feeds(user_id, updated_at DESC) WHERE status = 'error';

-- Recent articles (for performance on timeline views)
-- Note: Using static dates instead of NOW() since NOW() is not immutable
-- These indexes should be recreated periodically or use a different strategy
CREATE INDEX IF NOT EXISTS idx_articles_recent_published ON articles(published_at DESC, feed_id) 
  WHERE published_at >= '2024-01-01'::timestamptz;
CREATE INDEX IF NOT EXISTS idx_articles_recent_fetched ON articles(fetched_at DESC, feed_id) 
  WHERE fetched_at >= '2024-01-01'::timestamptz;

-- Articles with AI summaries (for AI-enhanced views)
CREATE INDEX IF NOT EXISTS idx_articles_with_ai_summary ON articles(feed_id, ai_summary_generated_at DESC) 
  WHERE ai_summary IS NOT NULL;

-- Articles with embeddings (for semantic search)
CREATE INDEX IF NOT EXISTS idx_articles_with_embeddings ON articles(feed_id, ai_summary_generated_at DESC) 
  WHERE embedding IS NOT NULL;

-- Successful sync logs (for health monitoring)
CREATE INDEX IF NOT EXISTS idx_feed_sync_success ON feed_sync_log(feed_id, sync_completed_at DESC) 
  WHERE status = 'success';

-- Failed sync logs (for error monitoring)
CREATE INDEX IF NOT EXISTS idx_feed_sync_errors ON feed_sync_log(feed_id, sync_started_at DESC) 
  WHERE status = 'error';

-- ============================================================================
-- FEED SYNCHRONIZATION OPTIMIZATION INDEXES
-- ============================================================================

-- ETL metadata for efficient feed polling
CREATE INDEX IF NOT EXISTS idx_feeds_etl_metadata ON feeds(url, etag, last_modified) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_feeds_polling_schedule ON feeds(custom_polling_interval, last_fetched_at) WHERE status = 'active';

-- Feed priority for sync ordering
CREATE INDEX IF NOT EXISTS idx_feeds_sync_priority ON feeds(priority, last_fetched_at ASC) WHERE status = 'active';

-- Article deduplication (GUID-based)
CREATE INDEX IF NOT EXISTS idx_articles_guid_lookup ON articles(feed_id, guid);

-- Bulk article operations
CREATE INDEX IF NOT EXISTS idx_articles_feed_bulk ON articles(feed_id, created_at DESC);

-- ============================================================================
-- USER READING PATTERN OPTIMIZATION INDEXES
-- ============================================================================

-- Reading session patterns
CREATE INDEX IF NOT EXISTS idx_user_articles_session ON user_articles(user_id, clicked_at, read_at) 
  WHERE clicked_at IS NOT NULL;

-- Reading time analytics
CREATE INDEX IF NOT EXISTS idx_user_articles_reading_time ON user_articles(user_id, time_spent_seconds) 
  WHERE time_spent_seconds IS NOT NULL AND time_spent_seconds > 0;

-- User engagement metrics
CREATE INDEX IF NOT EXISTS idx_user_articles_engagement ON user_articles(user_id, is_read, is_starred, clicked_at);

-- Feed popularity (for recommendations)
CREATE INDEX IF NOT EXISTS idx_feeds_article_count ON feeds(user_id, article_count DESC) WHERE status = 'active';

-- ============================================================================
-- CLUSTERING AND AI OPTIMIZATION INDEXES
-- ============================================================================

-- Cluster management
CREATE INDEX IF NOT EXISTS idx_clusters_timeframe ON clusters(timeframe_start DESC, timeframe_end DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_expiration ON clusters(expires_at ASC) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clusters_article_count_desc ON clusters(article_count DESC, created_at DESC);

-- Articles by cluster for cluster views
CREATE INDEX IF NOT EXISTS idx_articles_cluster_published ON articles(cluster_id, published_at DESC) 
  WHERE cluster_id IS NOT NULL;

-- AI processing coordination
CREATE INDEX IF NOT EXISTS idx_articles_ai_processing ON articles(ai_summary_generated_at ASC, embedding) 
  WHERE ai_summary IS NULL OR embedding IS NULL;

-- ============================================================================
-- RECOMMENDED FEEDS OPTIMIZATION INDEXES
-- ============================================================================

-- Category and region filtering (already exist, ensuring they're optimal)
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_category_popularity ON recommended_feeds(category, popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_country_popularity ON recommended_feeds(country, popularity_score DESC) 
  WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_language_popularity ON recommended_feeds(language, popularity_score DESC);

-- Featured feeds
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_featured ON recommended_feeds(is_featured, popularity_score DESC) 
  WHERE is_featured = true;

-- Tag-based search (GIN index already exists)
-- Ensuring we have optimal tag search patterns
CREATE INDEX IF NOT EXISTS idx_recommended_feeds_tags_category ON recommended_feeds(category) 
  WHERE array_length(tags, 1) > 0;

-- ============================================================================
-- DIGEST AND NOTIFICATION OPTIMIZATION INDEXES
-- ============================================================================

-- Digest delivery patterns
CREATE INDEX IF NOT EXISTS idx_digest_history_type_sent ON digest_history(user_id, digest_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_history_engagement ON digest_history(user_id, opened_at, clicked_at) 
  WHERE opened_at IS NOT NULL OR clicked_at IS NOT NULL;

-- Article inclusion in digests
CREATE INDEX IF NOT EXISTS idx_digest_history_articles ON digest_history USING GIN(article_ids) 
  WHERE array_length(article_ids, 1) > 0;

-- ============================================================================
-- MAINTENANCE AND CLEANUP OPTIMIZATION INDEXES
-- ============================================================================

-- Old data cleanup patterns
-- Note: Using static dates for immutable predicates
CREATE INDEX IF NOT EXISTS idx_articles_cleanup_age ON articles(published_at ASC, feed_id) 
  WHERE published_at < '2023-01-01'::timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_articles_cleanup ON user_articles(created_at ASC, is_read, is_starred) 
  WHERE created_at < '2023-01-01'::timestamptz AND is_read = true AND is_starred = false;

-- Sync log cleanup (automatic cleanup already exists, but optimizing queries)
CREATE INDEX IF NOT EXISTS idx_feed_sync_log_cleanup ON feed_sync_log(feed_id, sync_started_at ASC);

-- ============================================================================
-- STATISTICS AND ANALYTICS OPTIMIZATION INDEXES
-- ============================================================================

-- User statistics calculations
CREATE INDEX IF NOT EXISTS idx_user_articles_stats ON user_articles(user_id, is_read, is_starred, read_at);

-- Feed health metrics
CREATE INDEX IF NOT EXISTS idx_feeds_health_metrics ON feeds(user_id, status, last_fetched_at, article_count);

-- System-wide statistics
CREATE INDEX IF NOT EXISTS idx_articles_system_stats ON articles(created_at DESC, ai_summary_generated_at) 
  WHERE created_at >= '2024-01-01'::timestamptz;

-- ============================================================================
-- SEARCH AND DISCOVERY OPTIMIZATION INDEXES
-- ============================================================================

-- Text search preparation (for future full-text search)
CREATE INDEX IF NOT EXISTS idx_articles_title_search ON articles(feed_id, title) WHERE title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_content_length ON articles(feed_id, length(content)) WHERE content IS NOT NULL;

-- Author-based queries
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author, published_at DESC) WHERE author IS NOT NULL;

-- URL-based deduplication and lookup
CREATE INDEX IF NOT EXISTS idx_articles_url_lookup ON articles(url) WHERE url IS NOT NULL;

-- ============================================================================
-- PERFORMANCE MONITORING INDEXES
-- ============================================================================

-- Query performance monitoring
CREATE INDEX IF NOT EXISTS idx_feeds_performance_monitoring ON feeds(user_id, status, last_fetched_at, article_count, updated_at);
CREATE INDEX IF NOT EXISTS idx_articles_performance_monitoring ON articles(feed_id, published_at, fetched_at, ai_summary_generated_at);

-- Add comments for documentation
COMMENT ON INDEX idx_user_articles_user_read_status IS 'Optimizes user reading status queries - most common pattern';
COMMENT ON INDEX idx_articles_feed_published IS 'Optimizes feed timeline views ordered by publication date';
COMMENT ON INDEX idx_feeds_active_user IS 'Partial index for active feeds only - reduces index size significantly';
COMMENT ON INDEX idx_user_articles_unread IS 'Partial index for unread articles - critical for performance';
COMMENT ON INDEX idx_articles_recent_published IS 'Partial index for recent articles - improves timeline performance';
COMMENT ON INDEX idx_feed_sync_log_feed_started IS 'Optimizes feed sync history queries';
COMMENT ON INDEX idx_clusters_expiration IS 'Optimizes cluster cleanup operations';