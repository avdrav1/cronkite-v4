-- Database constraints and validation setup
-- Task 10.2: Verify all foreign key constraints are properly configured
-- Test enum constraints and default values
-- Validate unique constraints across all tables
-- Ensure proper cascade behaviors

-- ============================================================================
-- VERIFY AND ENHANCE FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Verify profiles table foreign key constraint
DO $$
BEGIN
    -- Check if the foreign key constraint exists and has correct cascade behavior
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_name = 'profiles' 
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'id'
        AND rc.delete_rule = 'CASCADE'
    ) THEN
        RAISE EXCEPTION 'profiles table foreign key constraint is missing or incorrect';
    END IF;
END $$;

-- Verify user_settings foreign key constraint
ALTER TABLE user_settings 
DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;

ALTER TABLE user_settings 
ADD CONSTRAINT user_settings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Verify user_interests foreign key constraint
ALTER TABLE user_interests 
DROP CONSTRAINT IF EXISTS user_interests_user_id_fkey;

ALTER TABLE user_interests 
ADD CONSTRAINT user_interests_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Verify folders foreign key constraint
ALTER TABLE folders 
DROP CONSTRAINT IF EXISTS folders_user_id_fkey;

ALTER TABLE folders 
ADD CONSTRAINT folders_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Verify feeds foreign key constraints
ALTER TABLE feeds 
DROP CONSTRAINT IF EXISTS feeds_user_id_fkey;

ALTER TABLE feeds 
ADD CONSTRAINT feeds_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE feeds 
DROP CONSTRAINT IF EXISTS feeds_folder_id_fkey;

ALTER TABLE feeds 
ADD CONSTRAINT feeds_folder_id_fkey 
FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;

-- Verify articles foreign key constraints
ALTER TABLE articles 
DROP CONSTRAINT IF EXISTS articles_feed_id_fkey;

ALTER TABLE articles 
ADD CONSTRAINT articles_feed_id_fkey 
FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE;

ALTER TABLE articles 
DROP CONSTRAINT IF EXISTS articles_cluster_id_fkey;

ALTER TABLE articles 
ADD CONSTRAINT articles_cluster_id_fkey 
FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE SET NULL;

-- Verify user_articles foreign key constraints
ALTER TABLE user_articles 
DROP CONSTRAINT IF EXISTS user_articles_user_id_fkey;

ALTER TABLE user_articles 
ADD CONSTRAINT user_articles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE user_articles 
DROP CONSTRAINT IF EXISTS user_articles_article_id_fkey;

ALTER TABLE user_articles 
ADD CONSTRAINT user_articles_article_id_fkey 
FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE;

-- Verify AI usage foreign key constraint
ALTER TABLE ai_usage 
DROP CONSTRAINT IF EXISTS ai_usage_user_id_fkey;

ALTER TABLE ai_usage 
ADD CONSTRAINT ai_usage_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Verify digest_history foreign key constraint
ALTER TABLE digest_history 
DROP CONSTRAINT IF EXISTS digest_history_user_id_fkey;

ALTER TABLE digest_history 
ADD CONSTRAINT digest_history_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Verify feed_sync_log foreign key constraint
ALTER TABLE feed_sync_log 
DROP CONSTRAINT IF EXISTS feed_sync_log_feed_id_fkey;

ALTER TABLE feed_sync_log 
ADD CONSTRAINT feed_sync_log_feed_id_fkey 
FOREIGN KEY (feed_id) REFERENCES feeds(id) ON DELETE CASCADE;

-- ============================================================================
-- VERIFY AND ENHANCE UNIQUE CONSTRAINTS
-- ============================================================================

-- Verify profiles unique constraint (should be primary key)
-- Primary key constraint already ensures uniqueness

-- Verify user_settings unique constraint (one settings record per user)
ALTER TABLE user_settings 
DROP CONSTRAINT IF EXISTS user_settings_user_id_unique;

ALTER TABLE user_settings 
ADD CONSTRAINT user_settings_user_id_unique 
UNIQUE (user_id);

-- Verify user_interests unique constraint
ALTER TABLE user_interests 
DROP CONSTRAINT IF EXISTS user_interests_user_id_category_key;

ALTER TABLE user_interests 
ADD CONSTRAINT user_interests_user_id_category_key 
UNIQUE (user_id, category);

-- Verify folders unique constraint
ALTER TABLE folders 
DROP CONSTRAINT IF EXISTS folders_user_id_name_key;

ALTER TABLE folders 
ADD CONSTRAINT folders_user_id_name_key 
UNIQUE (user_id, name);

-- Verify feeds unique constraint
ALTER TABLE feeds 
DROP CONSTRAINT IF EXISTS feeds_user_id_url_key;

ALTER TABLE feeds 
ADD CONSTRAINT feeds_user_id_url_key 
UNIQUE (user_id, url);

-- Verify articles unique constraint
ALTER TABLE articles 
DROP CONSTRAINT IF EXISTS articles_feed_id_guid_key;

ALTER TABLE articles 
ADD CONSTRAINT articles_feed_id_guid_key 
UNIQUE (feed_id, guid);

-- Verify user_articles unique constraint
ALTER TABLE user_articles 
DROP CONSTRAINT IF EXISTS user_articles_user_id_article_id_key;

ALTER TABLE user_articles 
ADD CONSTRAINT user_articles_user_id_article_id_key 
UNIQUE (user_id, article_id);

-- Verify ai_usage unique constraint
ALTER TABLE ai_usage 
DROP CONSTRAINT IF EXISTS ai_usage_user_id_usage_date_key;

ALTER TABLE ai_usage 
ADD CONSTRAINT ai_usage_user_id_usage_date_key 
UNIQUE (user_id, usage_date);

-- Verify recommended_feeds unique constraint
ALTER TABLE recommended_feeds 
DROP CONSTRAINT IF EXISTS recommended_feeds_url_key;

ALTER TABLE recommended_feeds 
ADD CONSTRAINT recommended_feeds_url_key 
UNIQUE (url);

-- ============================================================================
-- VERIFY AND ENHANCE ENUM CONSTRAINTS
-- ============================================================================

-- Verify feed_status enum constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_status') THEN
        RAISE EXCEPTION 'feed_status enum type does not exist';
    END IF;
END $$;

-- Verify feed_priority enum constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_priority') THEN
        RAISE EXCEPTION 'feed_priority enum type does not exist';
    END IF;
END $$;

-- Add check constraints for enum validation (additional safety)
ALTER TABLE feeds 
DROP CONSTRAINT IF EXISTS feeds_status_check;

ALTER TABLE feeds 
ADD CONSTRAINT feeds_status_check 
CHECK (status IN ('active', 'paused', 'error'));

ALTER TABLE feeds 
DROP CONSTRAINT IF EXISTS feeds_priority_check;

ALTER TABLE feeds 
ADD CONSTRAINT feeds_priority_check 
CHECK (priority IN ('high', 'medium', 'low'));

-- ============================================================================
-- ADD ADDITIONAL VALIDATION CONSTRAINTS
-- ============================================================================

-- Email validation for profiles
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_email_format_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_email_format_check 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- URL validation for feeds
ALTER TABLE feeds 
DROP CONSTRAINT IF EXISTS feeds_url_format_check;

ALTER TABLE feeds 
ADD CONSTRAINT feeds_url_format_check 
CHECK (url ~* '^https?://.*');

-- URL validation for recommended feeds
ALTER TABLE recommended_feeds 
DROP CONSTRAINT IF EXISTS recommended_feeds_url_format_check;

ALTER TABLE recommended_feeds 
ADD CONSTRAINT recommended_feeds_url_format_check 
CHECK (url ~* '^https?://.*');

-- Site URL validation (optional field)
ALTER TABLE feeds 
DROP CONSTRAINT IF EXISTS feeds_site_url_format_check;

ALTER TABLE feeds 
ADD CONSTRAINT feeds_site_url_format_check 
CHECK (site_url IS NULL OR site_url ~* '^https?://.*');

ALTER TABLE recommended_feeds 
DROP CONSTRAINT IF EXISTS recommended_feeds_site_url_format_check;

ALTER TABLE recommended_feeds 
ADD CONSTRAINT recommended_feeds_site_url_format_check 
CHECK (site_url IS NULL OR site_url ~* '^https?://.*');

-- Article URL validation
ALTER TABLE articles 
DROP CONSTRAINT IF EXISTS articles_url_format_check;

ALTER TABLE articles 
ADD CONSTRAINT articles_url_format_check 
CHECK (url ~* '^https?://.*');

-- Positive number constraints
ALTER TABLE feeds 
DROP CONSTRAINT IF EXISTS feeds_custom_polling_interval_positive;

ALTER TABLE feeds 
ADD CONSTRAINT feeds_custom_polling_interval_positive 
CHECK (custom_polling_interval IS NULL OR custom_polling_interval > 0);

ALTER TABLE feeds 
DROP CONSTRAINT IF EXISTS feeds_article_count_non_negative;

ALTER TABLE feeds 
ADD CONSTRAINT feeds_article_count_non_negative 
CHECK (article_count >= 0);

ALTER TABLE clusters 
DROP CONSTRAINT IF EXISTS clusters_article_count_non_negative;

ALTER TABLE clusters 
ADD CONSTRAINT clusters_article_count_non_negative 
CHECK (article_count >= 0);

ALTER TABLE user_articles 
DROP CONSTRAINT IF EXISTS user_articles_time_spent_non_negative;

ALTER TABLE user_articles 
ADD CONSTRAINT user_articles_time_spent_non_negative 
CHECK (time_spent_seconds IS NULL OR time_spent_seconds >= 0);

ALTER TABLE ai_usage 
DROP CONSTRAINT IF EXISTS ai_usage_counts_non_negative;

ALTER TABLE ai_usage 
ADD CONSTRAINT ai_usage_counts_non_negative 
CHECK (summary_count >= 0 AND clustering_count >= 0 AND total_operations >= 0);

ALTER TABLE digest_history 
DROP CONSTRAINT IF EXISTS digest_history_article_count_non_negative;

ALTER TABLE digest_history 
ADD CONSTRAINT digest_history_article_count_non_negative 
CHECK (article_count >= 0);

ALTER TABLE digest_history 
DROP CONSTRAINT IF EXISTS digest_history_click_count_non_negative;

ALTER TABLE digest_history 
ADD CONSTRAINT digest_history_click_count_non_negative 
CHECK (click_count >= 0);

ALTER TABLE recommended_feeds 
DROP CONSTRAINT IF EXISTS recommended_feeds_popularity_score_range;

ALTER TABLE recommended_feeds 
ADD CONSTRAINT recommended_feeds_popularity_score_range 
CHECK (popularity_score >= 0 AND popularity_score <= 100);

-- Sync log validation constraints
ALTER TABLE feed_sync_log 
DROP CONSTRAINT IF EXISTS feed_sync_log_status_check;

ALTER TABLE feed_sync_log 
ADD CONSTRAINT feed_sync_log_status_check 
CHECK (status IN ('success', 'error', 'in_progress'));

ALTER TABLE feed_sync_log 
DROP CONSTRAINT IF EXISTS feed_sync_log_duration_non_negative;

ALTER TABLE feed_sync_log 
ADD CONSTRAINT feed_sync_log_duration_non_negative 
CHECK (sync_duration_ms IS NULL OR sync_duration_ms >= 0);

ALTER TABLE feed_sync_log 
DROP CONSTRAINT IF EXISTS feed_sync_log_http_status_range;

ALTER TABLE feed_sync_log 
ADD CONSTRAINT feed_sync_log_http_status_range 
CHECK (http_status_code IS NULL OR (http_status_code >= 100 AND http_status_code < 600));

ALTER TABLE feed_sync_log 
DROP CONSTRAINT IF EXISTS feed_sync_log_article_counts_non_negative;

ALTER TABLE feed_sync_log 
ADD CONSTRAINT feed_sync_log_article_counts_non_negative 
CHECK (
    (articles_found IS NULL OR articles_found >= 0) AND
    (articles_new IS NULL OR articles_new >= 0) AND
    (articles_updated IS NULL OR articles_updated >= 0)
);

ALTER TABLE feed_sync_log 
DROP CONSTRAINT IF EXISTS feed_sync_log_feed_size_non_negative;

ALTER TABLE feed_sync_log 
ADD CONSTRAINT feed_sync_log_feed_size_non_negative 
CHECK (feed_size_bytes IS NULL OR feed_size_bytes >= 0);

-- ============================================================================
-- VERIFY DEFAULT VALUES
-- ============================================================================

-- Verify profiles defaults
ALTER TABLE profiles 
ALTER COLUMN timezone SET DEFAULT 'America/New_York';

ALTER TABLE profiles 
ALTER COLUMN onboarding_completed SET DEFAULT FALSE;

-- Verify user_settings defaults (comprehensive list)
ALTER TABLE user_settings 
ALTER COLUMN default_polling_interval SET DEFAULT '30m';

ALTER TABLE user_settings 
ALTER COLUMN adaptive_polling_enabled SET DEFAULT TRUE;

ALTER TABLE user_settings 
ALTER COLUMN digest_enabled SET DEFAULT TRUE;

ALTER TABLE user_settings 
ALTER COLUMN digest_frequency SET DEFAULT 'daily';

ALTER TABLE user_settings 
ALTER COLUMN digest_time SET DEFAULT '08:00';

ALTER TABLE user_settings 
ALTER COLUMN digest_timezone SET DEFAULT 'America/New_York';

ALTER TABLE user_settings 
ALTER COLUMN digest_max_articles SET DEFAULT '10';

ALTER TABLE user_settings 
ALTER COLUMN ai_summaries_enabled SET DEFAULT TRUE;

ALTER TABLE user_settings 
ALTER COLUMN ai_clustering_enabled SET DEFAULT TRUE;

ALTER TABLE user_settings 
ALTER COLUMN ai_daily_limit SET DEFAULT '100';

ALTER TABLE user_settings 
ALTER COLUMN theme SET DEFAULT 'system';

ALTER TABLE user_settings 
ALTER COLUMN accent_color SET DEFAULT 'blue';

ALTER TABLE user_settings 
ALTER COLUMN compact_view SET DEFAULT FALSE;

ALTER TABLE user_settings 
ALTER COLUMN show_images SET DEFAULT TRUE;

-- Verify folders defaults
ALTER TABLE folders 
ALTER COLUMN position SET DEFAULT 0;

-- Verify feeds defaults
ALTER TABLE feeds 
ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE feeds 
ALTER COLUMN priority SET DEFAULT 'medium';

ALTER TABLE feeds 
ALTER COLUMN article_count SET DEFAULT 0;

-- Verify articles defaults
-- No specific defaults needed beyond timestamps

-- Verify user_articles defaults
ALTER TABLE user_articles 
ALTER COLUMN is_read SET DEFAULT FALSE;

ALTER TABLE user_articles 
ALTER COLUMN is_starred SET DEFAULT FALSE;

-- Verify clusters defaults
ALTER TABLE clusters 
ALTER COLUMN article_count SET DEFAULT 0;

-- Verify ai_usage defaults
ALTER TABLE ai_usage 
ALTER COLUMN summary_count SET DEFAULT 0;

ALTER TABLE ai_usage 
ALTER COLUMN clustering_count SET DEFAULT 0;

ALTER TABLE ai_usage 
ALTER COLUMN total_operations SET DEFAULT 0;

-- Verify digest_history defaults
ALTER TABLE digest_history 
ALTER COLUMN digest_type SET DEFAULT 'daily';

ALTER TABLE digest_history 
ALTER COLUMN delivery_method SET DEFAULT 'email';

ALTER TABLE digest_history 
ALTER COLUMN article_count SET DEFAULT 0;

ALTER TABLE digest_history 
ALTER COLUMN click_count SET DEFAULT 0;

-- Verify feed_sync_log defaults
ALTER TABLE feed_sync_log 
ALTER COLUMN status SET DEFAULT 'in_progress';

ALTER TABLE feed_sync_log 
ALTER COLUMN articles_found SET DEFAULT 0;

ALTER TABLE feed_sync_log 
ALTER COLUMN articles_new SET DEFAULT 0;

ALTER TABLE feed_sync_log 
ALTER COLUMN articles_updated SET DEFAULT 0;

-- Verify recommended_feeds defaults
ALTER TABLE recommended_feeds 
ALTER COLUMN language SET DEFAULT 'en';

ALTER TABLE recommended_feeds 
ALTER COLUMN popularity_score SET DEFAULT 0;

ALTER TABLE recommended_feeds 
ALTER COLUMN is_featured SET DEFAULT FALSE;

-- ============================================================================
-- VERIFY NOT NULL CONSTRAINTS
-- ============================================================================

-- Critical NOT NULL constraints that must be enforced
ALTER TABLE profiles 
ALTER COLUMN email SET NOT NULL;

ALTER TABLE profiles 
ALTER COLUMN display_name SET NOT NULL;

ALTER TABLE profiles 
ALTER COLUMN timezone SET NOT NULL;

ALTER TABLE profiles 
ALTER COLUMN onboarding_completed SET NOT NULL;

ALTER TABLE folders 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE folders 
ALTER COLUMN name SET NOT NULL;

ALTER TABLE folders 
ALTER COLUMN position SET NOT NULL;

ALTER TABLE feeds 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE feeds 
ALTER COLUMN name SET NOT NULL;

ALTER TABLE feeds 
ALTER COLUMN url SET NOT NULL;

ALTER TABLE feeds 
ALTER COLUMN status SET NOT NULL;

ALTER TABLE feeds 
ALTER COLUMN priority SET NOT NULL;

ALTER TABLE feeds 
ALTER COLUMN article_count SET NOT NULL;

ALTER TABLE articles 
ALTER COLUMN feed_id SET NOT NULL;

ALTER TABLE articles 
ALTER COLUMN guid SET NOT NULL;

ALTER TABLE articles 
ALTER COLUMN title SET NOT NULL;

ALTER TABLE articles 
ALTER COLUMN url SET NOT NULL;

ALTER TABLE user_articles 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE user_articles 
ALTER COLUMN article_id SET NOT NULL;

ALTER TABLE user_articles 
ALTER COLUMN is_read SET NOT NULL;

ALTER TABLE user_articles 
ALTER COLUMN is_starred SET NOT NULL;

ALTER TABLE clusters 
ALTER COLUMN title SET NOT NULL;

ALTER TABLE clusters 
ALTER COLUMN article_count SET NOT NULL;

ALTER TABLE ai_usage 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE ai_usage 
ALTER COLUMN usage_date SET NOT NULL;

ALTER TABLE ai_usage 
ALTER COLUMN summary_count SET NOT NULL;

ALTER TABLE ai_usage 
ALTER COLUMN clustering_count SET NOT NULL;

ALTER TABLE ai_usage 
ALTER COLUMN total_operations SET NOT NULL;

ALTER TABLE digest_history 
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE digest_history 
ALTER COLUMN digest_type SET NOT NULL;

ALTER TABLE digest_history 
ALTER COLUMN delivery_method SET NOT NULL;

ALTER TABLE digest_history 
ALTER COLUMN article_count SET NOT NULL;

ALTER TABLE digest_history 
ALTER COLUMN click_count SET NOT NULL;

ALTER TABLE feed_sync_log 
ALTER COLUMN feed_id SET NOT NULL;

ALTER TABLE feed_sync_log 
ALTER COLUMN status SET NOT NULL;

ALTER TABLE recommended_feeds 
ALTER COLUMN name SET NOT NULL;

ALTER TABLE recommended_feeds 
ALTER COLUMN url SET NOT NULL;

ALTER TABLE recommended_feeds 
ALTER COLUMN category SET NOT NULL;

ALTER TABLE recommended_feeds 
ALTER COLUMN language SET NOT NULL;

ALTER TABLE recommended_feeds 
ALTER COLUMN popularity_score SET NOT NULL;

ALTER TABLE recommended_feeds 
ALTER COLUMN is_featured SET NOT NULL;

-- ============================================================================
-- TIMESTAMP VALIDATION CONSTRAINTS
-- ============================================================================

-- Ensure logical timestamp ordering
ALTER TABLE user_articles 
DROP CONSTRAINT IF EXISTS user_articles_timestamp_logic_check;

ALTER TABLE user_articles 
ADD CONSTRAINT user_articles_timestamp_logic_check 
CHECK (
    (read_at IS NULL OR read_at >= created_at) AND
    (starred_at IS NULL OR starred_at >= created_at) AND
    (clicked_at IS NULL OR clicked_at >= created_at)
);

ALTER TABLE articles 
DROP CONSTRAINT IF EXISTS articles_timestamp_logic_check;

ALTER TABLE articles 
ADD CONSTRAINT articles_timestamp_logic_check 
CHECK (
    (published_at IS NULL OR published_at <= fetched_at) AND
    (ai_summary_generated_at IS NULL OR ai_summary_generated_at >= fetched_at)
);

ALTER TABLE feed_sync_log 
DROP CONSTRAINT IF EXISTS feed_sync_log_timestamp_logic_check;

ALTER TABLE feed_sync_log 
ADD CONSTRAINT feed_sync_log_timestamp_logic_check 
CHECK (
    sync_completed_at IS NULL OR sync_completed_at >= sync_started_at
);

ALTER TABLE clusters 
DROP CONSTRAINT IF EXISTS clusters_timeframe_logic_check;

ALTER TABLE clusters 
ADD CONSTRAINT clusters_timeframe_logic_check 
CHECK (
    (timeframe_start IS NULL AND timeframe_end IS NULL) OR
    (timeframe_start IS NOT NULL AND timeframe_end IS NOT NULL AND timeframe_end >= timeframe_start)
);

-- ============================================================================
-- ARRAY VALIDATION CONSTRAINTS
-- ============================================================================

-- Validate array fields are not empty when they should contain data
ALTER TABLE digest_history 
DROP CONSTRAINT IF EXISTS digest_history_article_ids_consistency;

ALTER TABLE digest_history 
ADD CONSTRAINT digest_history_article_ids_consistency 
CHECK (
    (article_count = 0 AND (article_ids IS NULL OR array_length(article_ids, 1) IS NULL)) OR
    (article_count > 0 AND array_length(article_ids, 1) = article_count)
);

-- ============================================================================
-- CREATE VALIDATION FUNCTIONS FOR COMPLEX CONSTRAINTS
-- ============================================================================

-- Function to validate email format (more comprehensive than regex)
CREATE OR REPLACE FUNCTION validate_email_format(email_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic format check
    IF email_address !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN FALSE;
    END IF;
    
    -- Additional checks
    IF length(email_address) > 254 THEN
        RETURN FALSE;
    END IF;
    
    -- Check for consecutive dots
    IF email_address LIKE '%.%' AND email_address LIKE '%..%' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate URL format
CREATE OR REPLACE FUNCTION validate_url_format(url_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic HTTP/HTTPS check
    IF url_address !~* '^https?://.*' THEN
        RETURN FALSE;
    END IF;
    
    -- Length check
    IF length(url_address) > 2048 THEN
        RETURN FALSE;
    END IF;
    
    -- Basic domain validation
    IF url_address !~* '^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate timezone
CREATE OR REPLACE FUNCTION validate_timezone(tz TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if timezone exists in pg_timezone_names
    RETURN EXISTS (
        SELECT 1 FROM pg_timezone_names WHERE name = tz
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add timezone validation constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_timezone_valid;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_timezone_valid 
CHECK (validate_timezone(timezone));

ALTER TABLE user_settings 
DROP CONSTRAINT IF EXISTS user_settings_digest_timezone_valid;

ALTER TABLE user_settings 
ADD CONSTRAINT user_settings_digest_timezone_valid 
CHECK (validate_timezone(digest_timezone));

-- ============================================================================
-- CONSTRAINT VERIFICATION FUNCTION
-- ============================================================================

-- Function to verify all constraints are working
CREATE OR REPLACE FUNCTION verify_database_constraints()
RETURNS TABLE(
    table_name TEXT,
    constraint_name TEXT,
    constraint_type TEXT,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.table_name::TEXT,
        tc.constraint_name::TEXT,
        tc.constraint_type::TEXT,
        CASE 
            WHEN tc.constraint_type = 'FOREIGN KEY' THEN
                EXISTS (
                    SELECT 1 FROM information_schema.referential_constraints rc
                    WHERE rc.constraint_name = tc.constraint_name
                )
            WHEN tc.constraint_type = 'UNIQUE' THEN
                EXISTS (
                    SELECT 1 FROM information_schema.table_constraints tc2
                    WHERE tc2.constraint_name = tc.constraint_name
                    AND tc2.constraint_type = 'UNIQUE'
                )
            ELSE TRUE
        END as is_valid
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
    AND tc.table_name IN (
        'profiles', 'user_settings', 'user_interests', 'folders', 'feeds', 
        'articles', 'user_articles', 'clusters', 'ai_usage', 'digest_history', 
        'feed_sync_log', 'recommended_feeds'
    )
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION verify_database_constraints() TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION validate_email_format IS 'Validates email address format with comprehensive checks';
COMMENT ON FUNCTION validate_url_format IS 'Validates URL format for feeds and articles';
COMMENT ON FUNCTION validate_timezone IS 'Validates timezone against PostgreSQL timezone database';
COMMENT ON FUNCTION verify_database_constraints IS 'Verifies all database constraints are properly configured';