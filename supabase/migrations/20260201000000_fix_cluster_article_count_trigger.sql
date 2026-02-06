-- Migration: Fix cluster article count trigger to prevent negative counts
-- This fixes the clusters_article_count_non_negative constraint violation
-- that occurs when deleting articles from clusters with stale counts.

-- Drop and recreate the trigger function with GREATEST to prevent negative counts
CREATE OR REPLACE FUNCTION update_cluster_article_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update article count for the cluster
  IF TG_OP = 'INSERT' AND NEW.cluster_id IS NOT NULL THEN
    UPDATE clusters 
    SET article_count = article_count + 1,
        updated_at = NOW()
    WHERE id = NEW.cluster_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle cluster_id changes
    IF OLD.cluster_id IS DISTINCT FROM NEW.cluster_id THEN
      -- Decrease count for old cluster (use GREATEST to prevent negative)
      IF OLD.cluster_id IS NOT NULL THEN
        UPDATE clusters 
        SET article_count = GREATEST(article_count - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.cluster_id;
      END IF;
      -- Increase count for new cluster
      IF NEW.cluster_id IS NOT NULL THEN
        UPDATE clusters 
        SET article_count = article_count + 1,
            updated_at = NOW()
        WHERE id = NEW.cluster_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.cluster_id IS NOT NULL THEN
    -- Use GREATEST to prevent negative counts
    UPDATE clusters 
    SET article_count = GREATEST(article_count - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.cluster_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Also fix any existing clusters with negative or incorrect article counts
UPDATE clusters c
SET article_count = COALESCE(
  (SELECT COUNT(*) FROM articles a WHERE a.cluster_id = c.id),
  0
);

-- Log the fix
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count FROM clusters;
  RAISE NOTICE 'Fixed article counts for % clusters', fixed_count;
END $$;
