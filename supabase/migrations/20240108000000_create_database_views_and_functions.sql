-- Create database views and utility functions
-- Requirements: 14.1, 14.2, 14.3, 14.4, 14.5

-- Create articles_with_feed view for joined article data
-- Requirements: 14.1

CREATE OR REPLACE VIEW articles_with_feed AS
SELECT 
  a.id,
  a.feed_id,
  a.guid,
  a.title,
  a.url,
  a.author,
  a.excerpt,
  a.content,
  a.image_url,
  a.published_at,
  a.fetched_at,
  a.ai_summary,
  a.ai_summary_generated_at,
  a.embedding,
  a.cluster_id,
  a.created_at,
  -- Feed information
  f.name as feed_name,
  f.site_url as feed_site_url,
  f.description as feed_description,
  f.icon_url as feed_icon_url,
  f.icon_color as feed_icon_color,
  f.status as feed_status,
  f.priority as feed_priority,
  f.folder_id,
  f.user_id as feed_user_id,
  -- Folder information (if feed is in a folder)
  fo.name as folder_name,
  fo.icon as folder_icon,
  fo.position as folder_position
FROM articles a
JOIN feeds f ON a.feed_id = f.id
LEFT JOIN folders fo ON f.folder_id = fo.id;

-- Create user_article_feed view for complete reading interface
-- Requirements: 14.1, 14.2

CREATE OR REPLACE VIEW user_article_feed AS
SELECT 
  ua.id as user_article_id,
  ua.user_id,
  ua.article_id,
  ua.is_read,
  ua.read_at,
  ua.is_starred,
  ua.starred_at,
  ua.clicked_at,
  ua.time_spent_seconds,
  ua.created_at as user_article_created_at,
  ua.updated_at as user_article_updated_at,
  -- Article information
  a.feed_id,
  a.guid,
  a.title,
  a.url,
  a.author,
  a.excerpt,
  a.content,
  a.image_url,
  a.published_at,
  a.fetched_at,
  a.ai_summary,
  a.ai_summary_generated_at,
  a.cluster_id,
  a.created_at as article_created_at,
  -- Feed information
  f.name as feed_name,
  f.site_url as feed_site_url,
  f.description as feed_description,
  f.icon_url as feed_icon_url,
  f.icon_color as feed_icon_color,
  f.status as feed_status,
  f.priority as feed_priority,
  f.folder_id,
  -- Folder information (if feed is in a folder)
  fo.name as folder_name,
  fo.icon as folder_icon,
  fo.position as folder_position,
  -- Cluster information (if article is clustered)
  c.title as cluster_title,
  c.summary as cluster_summary,
  c.article_count as cluster_article_count
FROM user_articles ua
JOIN articles a ON ua.article_id = a.id
JOIN feeds f ON a.feed_id = f.id
LEFT JOIN folders fo ON f.folder_id = fo.id
LEFT JOIN clusters c ON a.cluster_id = c.id;

-- Create folder_unread_counts view for folder statistics
-- Requirements: 14.3

CREATE OR REPLACE VIEW folder_unread_counts AS
SELECT 
  fo.id as folder_id,
  fo.user_id,
  fo.name as folder_name,
  fo.icon as folder_icon,
  fo.position,
  fo.created_at,
  fo.updated_at,
  -- Feed counts
  COUNT(DISTINCT f.id) as total_feeds,
  COUNT(DISTINCT CASE WHEN f.status = 'active' THEN f.id END) as active_feeds,
  -- Article counts
  COUNT(DISTINCT a.id) as total_articles,
  COUNT(DISTINCT CASE WHEN ua.is_read = false OR ua.is_read IS NULL THEN a.id END) as unread_articles,
  COUNT(DISTINCT CASE WHEN ua.is_starred = true THEN a.id END) as starred_articles,
  -- Latest article timestamp
  MAX(a.published_at) as latest_article_published_at,
  MAX(a.fetched_at) as latest_article_fetched_at
FROM folders fo
LEFT JOIN feeds f ON fo.id = f.folder_id AND f.user_id = fo.user_id
LEFT JOIN articles a ON f.id = a.feed_id
LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = fo.user_id
GROUP BY fo.id, fo.user_id, fo.name, fo.icon, fo.position, fo.created_at, fo.updated_at;

-- Create feed_stats view for feed health metrics
-- Requirements: 14.3

CREATE OR REPLACE VIEW feed_stats AS
SELECT 
  f.id as feed_id,
  f.user_id,
  f.name as feed_name,
  f.url as feed_url,
  f.status,
  f.priority,
  f.folder_id,
  f.last_fetched_at,
  f.article_count as stored_article_count,
  f.created_at as feed_created_at,
  f.updated_at as feed_updated_at,
  -- Article statistics
  COUNT(DISTINCT a.id) as actual_article_count,
  COUNT(DISTINCT CASE WHEN ua.is_read = false OR ua.is_read IS NULL THEN a.id END) as unread_count,
  COUNT(DISTINCT CASE WHEN ua.is_starred = true THEN a.id END) as starred_count,
  -- Time-based article counts
  COUNT(DISTINCT CASE WHEN a.published_at >= NOW() - INTERVAL '24 hours' THEN a.id END) as articles_last_24h,
  COUNT(DISTINCT CASE WHEN a.published_at >= NOW() - INTERVAL '7 days' THEN a.id END) as articles_last_week,
  COUNT(DISTINCT CASE WHEN a.published_at >= NOW() - INTERVAL '30 days' THEN a.id END) as articles_last_month,
  -- Latest timestamps
  MAX(a.published_at) as latest_article_published_at,
  MAX(a.fetched_at) as latest_article_fetched_at,
  -- Sync statistics (from recent sync logs)
  (
    SELECT COUNT(*) 
    FROM feed_sync_log fsl 
    WHERE fsl.feed_id = f.id 
      AND fsl.sync_started_at >= NOW() - INTERVAL '7 days'
  ) as sync_attempts_last_week,
  (
    SELECT COUNT(*) 
    FROM feed_sync_log fsl 
    WHERE fsl.feed_id = f.id 
      AND fsl.status = 'success' 
      AND fsl.sync_started_at >= NOW() - INTERVAL '7 days'
  ) as successful_syncs_last_week,
  (
    SELECT MAX(fsl.sync_started_at) 
    FROM feed_sync_log fsl 
    WHERE fsl.feed_id = f.id 
      AND fsl.status = 'success'
  ) as last_successful_sync_at,
  (
    SELECT fsl.error_message 
    FROM feed_sync_log fsl 
    WHERE fsl.feed_id = f.id 
      AND fsl.status = 'error'
    ORDER BY fsl.sync_started_at DESC 
    LIMIT 1
  ) as last_error_message,
  -- Health score calculation (0-100)
  CASE 
    WHEN f.status = 'error' THEN 0
    WHEN f.status = 'paused' THEN 25
    WHEN f.last_fetched_at IS NULL THEN 50
    WHEN f.last_fetched_at < NOW() - INTERVAL '7 days' THEN 60
    WHEN f.last_fetched_at < NOW() - INTERVAL '24 hours' THEN 80
    ELSE 100
  END as health_score
FROM feeds f
LEFT JOIN articles a ON f.id = a.feed_id
LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = f.user_id
GROUP BY f.id, f.user_id, f.name, f.url, f.status, f.priority, f.folder_id, 
         f.last_fetched_at, f.article_count, f.created_at, f.updated_at;

-- Create view for unfoldered feeds (feeds not in any folder)
CREATE OR REPLACE VIEW unfoldered_feed_stats AS
SELECT 
  f.user_id,
  COUNT(DISTINCT f.id) as total_feeds,
  COUNT(DISTINCT CASE WHEN f.status = 'active' THEN f.id END) as active_feeds,
  COUNT(DISTINCT a.id) as total_articles,
  COUNT(DISTINCT CASE WHEN ua.is_read = false OR ua.is_read IS NULL THEN a.id END) as unread_articles,
  COUNT(DISTINCT CASE WHEN ua.is_starred = true THEN a.id END) as starred_articles,
  MAX(a.published_at) as latest_article_published_at,
  MAX(a.fetched_at) as latest_article_fetched_at
FROM feeds f
LEFT JOIN articles a ON f.id = a.feed_id
LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = f.user_id
WHERE f.folder_id IS NULL
GROUP BY f.user_id;

-- Create RLS policies for views (inherit from underlying tables)
-- Views automatically inherit RLS from their underlying tables, but we can add explicit policies if needed

-- Grant appropriate permissions on views
GRANT SELECT ON articles_with_feed TO authenticated;
GRANT SELECT ON user_article_feed TO authenticated;
GRANT SELECT ON folder_unread_counts TO authenticated;
GRANT SELECT ON feed_stats TO authenticated;
GRANT SELECT ON unfoldered_feed_stats TO authenticated;

-- ============================================================================
-- UTILITY FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Create calculate_relevancy_score function
-- Requirements: 14.4

CREATE OR REPLACE FUNCTION calculate_relevancy_score(
  p_article_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  relevancy_score NUMERIC := 0;
  article_age_days NUMERIC;
  feed_priority_weight NUMERIC;
  user_engagement_weight NUMERIC;
  cluster_popularity_weight NUMERIC;
BEGIN
  -- Get article and feed information
  SELECT 
    EXTRACT(DAYS FROM (NOW() - a.published_at)) as age_days,
    CASE f.priority
      WHEN 'high' THEN 3.0
      WHEN 'medium' THEN 2.0
      WHEN 'low' THEN 1.0
      ELSE 1.0
    END as priority_weight
  INTO article_age_days, feed_priority_weight
  FROM articles a
  JOIN feeds f ON a.feed_id = f.id
  WHERE a.id = p_article_id;
  
  -- Base score starts with feed priority
  relevancy_score := feed_priority_weight;
  
  -- Age factor: newer articles get higher scores
  -- Articles lose 10% relevancy per day, minimum 0.1
  IF article_age_days IS NOT NULL THEN
    relevancy_score := relevancy_score * GREATEST(0.1, 1.0 - (article_age_days * 0.1));
  END IF;
  
  -- User engagement factor (if user_id provided)
  IF p_user_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN ua.is_starred THEN 2.0
        WHEN ua.is_read THEN 1.2
        WHEN ua.clicked_at IS NOT NULL THEN 1.5
        ELSE 1.0
      END
    INTO user_engagement_weight
    FROM user_articles ua
    WHERE ua.article_id = p_article_id AND ua.user_id = p_user_id;
    
    relevancy_score := relevancy_score * COALESCE(user_engagement_weight, 1.0);
  END IF;
  
  -- Cluster popularity factor
  SELECT 
    CASE 
      WHEN c.article_count > 10 THEN 1.5
      WHEN c.article_count > 5 THEN 1.3
      WHEN c.article_count > 2 THEN 1.1
      ELSE 1.0
    END
  INTO cluster_popularity_weight
  FROM articles a
  LEFT JOIN clusters c ON a.cluster_id = c.id
  WHERE a.id = p_article_id;
  
  relevancy_score := relevancy_score * COALESCE(cluster_popularity_weight, 1.0);
  
  -- AI summary bonus: articles with AI summaries get slight boost
  IF EXISTS (
    SELECT 1 FROM articles 
    WHERE id = p_article_id AND ai_summary IS NOT NULL
  ) THEN
    relevancy_score := relevancy_score * 1.1;
  END IF;
  
  -- Normalize score to 0-100 range
  relevancy_score := LEAST(100, GREATEST(0, relevancy_score * 10));
  
  RETURN ROUND(relevancy_score, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create mark_folder_read bulk operation function
-- Requirements: 14.5

CREATE OR REPLACE FUNCTION mark_folder_read(
  p_folder_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  articles_marked INTEGER,
  articles_already_read INTEGER
) AS $$
DECLARE
  marked_count INTEGER := 0;
  already_read_count INTEGER := 0;
  article_record RECORD;
BEGIN
  -- Verify folder ownership
  IF NOT EXISTS (
    SELECT 1 FROM folders 
    WHERE id = p_folder_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Folder not found or access denied';
  END IF;
  
  -- Process each article in the folder
  FOR article_record IN
    SELECT DISTINCT a.id as article_id
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE f.folder_id = p_folder_id AND f.user_id = p_user_id
  LOOP
    -- Insert or update user_articles record
    INSERT INTO user_articles (
      user_id,
      article_id,
      is_read,
      read_at
    ) VALUES (
      p_user_id,
      article_record.article_id,
      true,
      NOW()
    )
    ON CONFLICT (user_id, article_id)
    DO UPDATE SET
      is_read = CASE 
        WHEN user_articles.is_read = false THEN true
        ELSE user_articles.is_read
      END,
      read_at = CASE 
        WHEN user_articles.is_read = false THEN NOW()
        ELSE user_articles.read_at
      END,
      updated_at = NOW();
    
    -- Count the operation result
    IF FOUND AND (SELECT is_read FROM user_articles WHERE user_id = p_user_id AND article_id = article_record.article_id) = true THEN
      -- Check if this was a new read or already read
      IF (SELECT read_at FROM user_articles WHERE user_id = p_user_id AND article_id = article_record.article_id) = NOW()::TIMESTAMPTZ THEN
        marked_count := marked_count + 1;
      ELSE
        already_read_count := already_read_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT marked_count, already_read_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create mark_feed_read bulk operation function
CREATE OR REPLACE FUNCTION mark_feed_read(
  p_feed_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  articles_marked INTEGER,
  articles_already_read INTEGER
) AS $$
DECLARE
  marked_count INTEGER := 0;
  already_read_count INTEGER := 0;
  article_record RECORD;
BEGIN
  -- Verify feed ownership
  IF NOT EXISTS (
    SELECT 1 FROM feeds 
    WHERE id = p_feed_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Feed not found or access denied';
  END IF;
  
  -- Process each article in the feed
  FOR article_record IN
    SELECT a.id as article_id
    FROM articles a
    WHERE a.feed_id = p_feed_id
  LOOP
    -- Insert or update user_articles record
    INSERT INTO user_articles (
      user_id,
      article_id,
      is_read,
      read_at
    ) VALUES (
      p_user_id,
      article_record.article_id,
      true,
      NOW()
    )
    ON CONFLICT (user_id, article_id)
    DO UPDATE SET
      is_read = CASE 
        WHEN user_articles.is_read = false THEN true
        ELSE user_articles.is_read
      END,
      read_at = CASE 
        WHEN user_articles.is_read = false THEN NOW()
        ELSE user_articles.read_at
      END,
      updated_at = NOW();
    
    -- Count the operation result
    IF FOUND THEN
      -- Check if this was a new read or already read
      IF (SELECT read_at FROM user_articles WHERE user_id = p_user_id AND article_id = article_record.article_id) >= NOW() - INTERVAL '1 second' THEN
        marked_count := marked_count + 1;
      ELSE
        already_read_count := already_read_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT marked_count, already_read_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create mark_all_read bulk operation function (for user's entire feed collection)
CREATE OR REPLACE FUNCTION mark_all_read(p_user_id UUID)
RETURNS TABLE(
  articles_marked INTEGER,
  articles_already_read INTEGER
) AS $$
DECLARE
  marked_count INTEGER := 0;
  already_read_count INTEGER := 0;
  article_record RECORD;
BEGIN
  -- Process each article from user's subscribed feeds
  FOR article_record IN
    SELECT DISTINCT a.id as article_id
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE f.user_id = p_user_id
  LOOP
    -- Insert or update user_articles record
    INSERT INTO user_articles (
      user_id,
      article_id,
      is_read,
      read_at
    ) VALUES (
      p_user_id,
      article_record.article_id,
      true,
      NOW()
    )
    ON CONFLICT (user_id, article_id)
    DO UPDATE SET
      is_read = CASE 
        WHEN user_articles.is_read = false THEN true
        ELSE user_articles.is_read
      END,
      read_at = CASE 
        WHEN user_articles.is_read = false THEN NOW()
        ELSE user_articles.read_at
      END,
      updated_at = NOW();
    
    -- Count the operation result
    IF FOUND THEN
      -- Check if this was a new read or already read
      IF (SELECT read_at FROM user_articles WHERE user_id = p_user_id AND article_id = article_record.article_id) >= NOW() - INTERVAL '1 second' THEN
        marked_count := marked_count + 1;
      ELSE
        already_read_count := already_read_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT marked_count, already_read_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's reading statistics
CREATE OR REPLACE FUNCTION get_user_reading_stats(p_user_id UUID)
RETURNS TABLE(
  total_articles INTEGER,
  read_articles INTEGER,
  unread_articles INTEGER,
  starred_articles INTEGER,
  reading_percentage NUMERIC,
  articles_read_today INTEGER,
  articles_read_this_week INTEGER,
  articles_read_this_month INTEGER,
  avg_reading_time_seconds NUMERIC,
  total_feeds INTEGER,
  active_feeds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT a.id)::INTEGER as total_articles,
    COUNT(DISTINCT CASE WHEN ua.is_read = true THEN a.id END)::INTEGER as read_articles,
    COUNT(DISTINCT CASE WHEN ua.is_read = false OR ua.is_read IS NULL THEN a.id END)::INTEGER as unread_articles,
    COUNT(DISTINCT CASE WHEN ua.is_starred = true THEN a.id END)::INTEGER as starred_articles,
    CASE 
      WHEN COUNT(DISTINCT a.id) > 0 THEN 
        ROUND((COUNT(DISTINCT CASE WHEN ua.is_read = true THEN a.id END)::NUMERIC / COUNT(DISTINCT a.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END as reading_percentage,
    COUNT(DISTINCT CASE WHEN ua.read_at >= CURRENT_DATE THEN a.id END)::INTEGER as articles_read_today,
    COUNT(DISTINCT CASE WHEN ua.read_at >= CURRENT_DATE - INTERVAL '7 days' THEN a.id END)::INTEGER as articles_read_this_week,
    COUNT(DISTINCT CASE WHEN ua.read_at >= CURRENT_DATE - INTERVAL '30 days' THEN a.id END)::INTEGER as articles_read_this_month,
    ROUND(AVG(ua.time_spent_seconds) FILTER (WHERE ua.time_spent_seconds IS NOT NULL), 2) as avg_reading_time_seconds,
    COUNT(DISTINCT f.id)::INTEGER as total_feeds,
    COUNT(DISTINCT CASE WHEN f.status = 'active' THEN f.id END)::INTEGER as active_feeds
  FROM feeds f
  LEFT JOIN articles a ON f.id = a.feed_id
  LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = f.user_id
  WHERE f.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to clean up old user article states (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_user_articles(
  p_user_id UUID,
  p_days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete user_articles records for articles older than specified days
  -- Only delete if the article is read and not starred
  DELETE FROM user_articles ua
  USING articles a
  WHERE ua.article_id = a.id
    AND ua.user_id = p_user_id
    AND ua.is_read = true
    AND ua.is_starred = false
    AND a.published_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get article recommendations based on user reading patterns
CREATE OR REPLACE FUNCTION get_article_recommendations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  article_id UUID,
  title TEXT,
  feed_name TEXT,
  relevancy_score NUMERIC,
  published_at TIMESTAMPTZ,
  ai_summary TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as article_id,
    a.title,
    f.name as feed_name,
    calculate_relevancy_score(a.id, p_user_id) as relevancy_score,
    a.published_at,
    a.ai_summary
  FROM articles a
  JOIN feeds f ON a.feed_id = f.id
  LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = p_user_id
  WHERE f.user_id = p_user_id
    AND f.status = 'active'
    AND (ua.is_read IS NULL OR ua.is_read = false)
    AND a.published_at >= NOW() - INTERVAL '7 days'
  ORDER BY calculate_relevancy_score(a.id, p_user_id) DESC, a.published_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on utility functions
GRANT EXECUTE ON FUNCTION calculate_relevancy_score(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_folder_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_feed_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_reading_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_user_articles(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_article_recommendations(UUID, INTEGER) TO authenticated;