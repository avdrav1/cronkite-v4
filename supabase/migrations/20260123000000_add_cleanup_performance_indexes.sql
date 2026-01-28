-- Add performance indexes for article cleanup queries
-- Task 1.3: Add performance indexes for cleanup queries
-- Requirements: 7.1

-- ============================================================================
-- CLEANUP QUERY OPTIMIZATION INDEXES
-- ============================================================================

-- Index for efficient article ordering by feed and published date
-- This index already exists from 20240110000000_create_performance_indexes.sql
-- but we verify it here for cleanup query optimization
-- CREATE INDEX IF NOT EXISTS idx_articles_feed_published ON articles(feed_id, published_at DESC);

-- Partial index for protected articles (starred or read)
-- This significantly improves cleanup queries that need to identify protected articles
-- Only indexes articles that are actually protected, saving space
CREATE INDEX IF NOT EXISTS idx_user_articles_protected 
  ON user_articles(user_id, article_id) 
  WHERE is_starred = true OR is_read = true;

-- Composite index for cleanup queries that need to find old unread articles
-- Helps identify articles eligible for age-based cleanup
CREATE INDEX IF NOT EXISTS idx_user_articles_cleanup_candidates 
  ON user_articles(user_id, article_id, created_at DESC) 
  WHERE is_starred = false AND is_read = false;

-- Index for multi-user article protection checks
-- Helps determine if an article is protected by any user before deletion
CREATE INDEX IF NOT EXISTS idx_user_articles_article_protection 
  ON user_articles(article_id) 
  WHERE is_starred = true OR is_read = true;

-- Index for articles with comments (protected from deletion)
-- Helps quickly identify articles that have comments and should be preserved
CREATE INDEX IF NOT EXISTS idx_article_comments_article_id 
  ON article_comments(article_id);

-- Add comments for documentation
COMMENT ON INDEX idx_user_articles_protected IS 'Partial index for protected articles (starred or read) - optimizes cleanup queries';
COMMENT ON INDEX idx_user_articles_cleanup_candidates IS 'Identifies unread, unstarred articles eligible for cleanup';
COMMENT ON INDEX idx_user_articles_article_protection IS 'Checks if any user protects an article before deletion';
COMMENT ON INDEX idx_article_comments_article_id IS 'Identifies articles with comments that should be preserved';

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_user_articles_protected;
-- DROP INDEX IF EXISTS idx_user_articles_cleanup_candidates;
-- DROP INDEX IF EXISTS idx_user_articles_article_protection;
-- DROP INDEX IF EXISTS idx_article_comments_article_id;
