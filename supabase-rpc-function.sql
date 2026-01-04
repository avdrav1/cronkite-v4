-- SQL function to efficiently count articles by feed
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_article_counts_by_feed(feed_ids UUID[])
RETURNS TABLE(feed_id UUID, count BIGINT)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    a.feed_id,
    COUNT(*) as count
  FROM articles a
  WHERE a.feed_id = ANY(feed_ids)
  GROUP BY a.feed_id;
$$;
