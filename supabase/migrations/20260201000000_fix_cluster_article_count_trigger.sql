-- Migration: Fix cluster article count trigger + add efficient cleanup function
-- This fixes the clusters_article_count_non_negative constraint violation
-- and adds a server-side cleanup function that runs efficiently in the database.

-- ============================================================================
-- PART 1: Fix the trigger to prevent negative article counts
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cluster_article_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.cluster_id IS NOT NULL THEN
    UPDATE clusters 
    SET article_count = article_count + 1, updated_at = NOW()
    WHERE id = NEW.cluster_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.cluster_id IS DISTINCT FROM NEW.cluster_id THEN
      IF OLD.cluster_id IS NOT NULL THEN
        UPDATE clusters 
        SET article_count = GREATEST(article_count - 1, 0), updated_at = NOW()
        WHERE id = OLD.cluster_id;
      END IF;
      IF NEW.cluster_id IS NOT NULL THEN
        UPDATE clusters 
        SET article_count = article_count + 1, updated_at = NOW()
        WHERE id = NEW.cluster_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.cluster_id IS NOT NULL THEN
    UPDATE clusters 
    SET article_count = GREATEST(article_count - 1, 0), updated_at = NOW()
    WHERE id = OLD.cluster_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Fix existing clusters with incorrect counts
UPDATE clusters c
SET article_count = COALESCE(
  (SELECT COUNT(*) FROM articles a WHERE a.cluster_id = c.id), 0
);

-- ============================================================================
-- PART 2: Create efficient server-side cleanup function
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_feed_articles(
  p_feed_id UUID,
  p_max_articles INTEGER DEFAULT 100,
  p_max_age_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_batch_deleted INTEGER;
  v_batch_ids UUID[];
BEGIN
  -- Step 1: Remove cluster associations for articles we're about to delete
  -- This avoids the constraint violation by nullifying cluster_id first
  UPDATE articles
  SET cluster_id = NULL
  WHERE id IN (
    -- Articles exceeding per-feed limit (not protected)
    SELECT a.id FROM articles a
    LEFT JOIN user_articles ua ON ua.article_id = a.id AND (ua.is_read = true OR ua.is_starred = true)
    LEFT JOIN article_comments ac ON ac.article_id = a.id
    WHERE a.feed_id = p_feed_id
      AND ua.id IS NULL
      AND ac.id IS NULL
      AND a.id NOT IN (
        SELECT a2.id FROM articles a2
        WHERE a2.feed_id = p_feed_id
        ORDER BY a2.published_at DESC NULLS LAST
        LIMIT p_max_articles
      )
    UNION
    -- Articles exceeding age threshold (not protected)
    SELECT a.id FROM articles a
    LEFT JOIN user_articles ua ON ua.article_id = a.id AND (ua.is_read = true OR ua.is_starred = true)
    LEFT JOIN article_comments ac ON ac.article_id = a.id
    WHERE a.feed_id = p_feed_id
      AND ua.id IS NULL
      AND ac.id IS NULL
      AND a.published_at < NOW() - (p_max_age_days || ' days')::INTERVAL
  )
  AND cluster_id IS NOT NULL;

  -- Step 2: Delete articles in batches of 200 to avoid long locks
  LOOP
    SELECT ARRAY(
      SELECT a.id FROM articles a
      LEFT JOIN user_articles ua ON ua.article_id = a.id AND (ua.is_read = true OR ua.is_starred = true)
      LEFT JOIN article_comments ac ON ac.article_id = a.id
      WHERE a.feed_id = p_feed_id
        AND ua.id IS NULL
        AND ac.id IS NULL
        AND a.cluster_id IS NULL  -- Only delete articles already removed from clusters
        AND (
          -- Exceeds per-feed limit
          a.id NOT IN (
            SELECT a2.id FROM articles a2
            WHERE a2.feed_id = p_feed_id
            ORDER BY a2.published_at DESC NULLS LAST
            LIMIT p_max_articles
          )
          OR
          -- Exceeds age threshold
          a.published_at < NOW() - (p_max_age_days || ' days')::INTERVAL
        )
      LIMIT 200
    ) INTO v_batch_ids;

    EXIT WHEN array_length(v_batch_ids, 1) IS NULL OR array_length(v_batch_ids, 1) = 0;

    DELETE FROM articles WHERE id = ANY(v_batch_ids);
    GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;
    v_deleted := v_deleted + v_batch_deleted;
  END LOOP;

  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 3: Create cleanup_log table if it doesn't exist
-- ============================================================================

CREATE TABLE IF NOT EXISTS cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('sync', 'scheduled', 'manual')),
  articles_deleted INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleanup_log_user_id ON cleanup_log(user_id);
CREATE INDEX IF NOT EXISTS idx_cleanup_log_created_at ON cleanup_log(created_at DESC);
