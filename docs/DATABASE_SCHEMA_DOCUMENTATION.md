# Cronkite Database Schema Documentation

## Overview

This document provides comprehensive documentation for the Cronkite database schema, including table structures, relationships, views, functions, and common usage patterns. The database is built on PostgreSQL with Supabase for authentication and hosting.

## Table of Contents

1. [Database Architecture](#database-architecture)
2. [Core Tables](#core-tables)
3. [Database Views](#database-views)
4. [Functions and Procedures](#functions-and-procedures)
5. [Indexes and Performance](#indexes-and-performance)
6. [Row Level Security (RLS)](#row-level-security-rls)
7. [Common Query Patterns](#common-query-patterns)
8. [Application Integration](#application-integration)
9. [Backup and Maintenance](#backup-and-maintenance)

## Database Architecture

### Technology Stack
- **Database**: PostgreSQL 17
- **Hosting**: Supabase
- **Extensions**: uuid-ossp, pgcrypto, vector (optional)
- **Authentication**: Supabase Auth with RLS policies

### Schema Organization
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Mgmt     │    │   Feed Mgmt     │    │   Content       │
│                 │    │                 │    │                 │
│ • profiles      │    │ • folders       │    │ • articles      │
│ • user_settings │    │ • feeds         │    │ • clusters      │
│ • user_interests│    │ • recommended   │    │ • user_articles │
│                 │    │   _feeds        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────┐
         │              System Operations                  │
         │                                                 │
         │ • feed_sync_log    • ai_usage                  │
         │ • cleanup_log      • digest_history            │
         └─────────────────────────────────────────────────┘
```

## Core Tables

### User Management Tables

#### profiles
Extends Supabase auth.users with application-specific data.

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    region_code TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Key Features:**
- Automatic creation via trigger when auth.users record is created
- Cascade delete ensures cleanup when user account is deleted
- Default timezone and onboarding status

#### user_settings
Comprehensive user preference storage.

```sql
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Polling preferences
    polling_interval_minutes INTEGER DEFAULT 60,
    enable_adaptive_polling BOOLEAN DEFAULT TRUE,
    -- Digest preferences  
    digest_enabled BOOLEAN DEFAULT TRUE,
    digest_frequency TEXT DEFAULT 'daily',
    digest_time TIME DEFAULT '08:00:00',
    digest_timezone TEXT DEFAULT 'America/New_York',
    -- AI preferences
    enable_ai_summaries BOOLEAN DEFAULT TRUE,
    enable_ai_clustering BOOLEAN DEFAULT TRUE,
    ai_summary_length TEXT DEFAULT 'medium',
    -- Appearance preferences
    theme TEXT DEFAULT 'system',
    accent_color TEXT DEFAULT 'blue',
    -- Cleanup preferences (Article Cleanup System)
    articles_per_feed INTEGER DEFAULT 100,
    unread_article_age_days INTEGER DEFAULT 30,
    enable_auto_cleanup BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT user_settings_user_id_unique UNIQUE(user_id)
);
```

**Cleanup Settings:**
- `articles_per_feed`: Maximum articles to keep per feed (range: 50-500, default: 100)
- `unread_article_age_days`: Maximum age in days for unread articles (range: 7-90, default: 30)
- `enable_auto_cleanup`: Whether automatic cleanup is enabled (default: true)

#### user_interests
Stores user interest categories from onboarding.

```sql
CREATE TABLE user_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    selected_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT user_interests_unique UNIQUE(user_id, category)
);
```

### Feed Management Tables

#### folders
Hierarchical organization for RSS feeds.

```sql
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT folders_user_name_unique UNIQUE(user_id, name)
);
```

#### feeds
RSS feed subscriptions with comprehensive metadata.

```sql
CREATE TABLE feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    site_url TEXT,
    description TEXT,
    icon_url TEXT,
    icon_color TEXT,
    status feed_status DEFAULT 'active',
    priority feed_priority DEFAULT 'medium',
    custom_polling_interval INTEGER,
    last_fetched_at TIMESTAMPTZ,
    etag TEXT,
    last_modified TEXT,
    article_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT feeds_user_url_unique UNIQUE(user_id, url)
);
```

**Enums:**
```sql
CREATE TYPE feed_status AS ENUM ('active', 'paused', 'error');
CREATE TYPE feed_priority AS ENUM ('high', 'medium', 'low');
```

#### recommended_feeds
Curated directory of recommended RSS feeds.

```sql
CREATE TABLE recommended_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    site_url TEXT,
    description TEXT,
    icon_url TEXT,
    category TEXT NOT NULL,
    country TEXT,
    language TEXT DEFAULT 'en',
    tags TEXT[],
    popularity_score INTEGER DEFAULT 0,
    article_frequency TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Content Tables

#### articles
Article content with AI enhancement fields.

```sql
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    guid TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    author TEXT,
    excerpt TEXT,
    content TEXT,
    image_url TEXT,
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    ai_summary TEXT,
    ai_summary_generated_at TIMESTAMPTZ,
    embedding VECTOR(1536), -- For semantic search
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT articles_feed_guid_unique UNIQUE(feed_id, guid)
);
```

#### user_articles
Per-user article state (read/starred status).

```sql
CREATE TABLE user_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    is_starred BOOLEAN DEFAULT FALSE,
    starred_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    time_spent_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT user_articles_unique UNIQUE(user_id, article_id)
);
```

#### clusters
AI-generated topic groupings.

```sql
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    article_count INTEGER DEFAULT 0,
    source_feeds TEXT[],
    timeframe_start TIMESTAMPTZ,
    timeframe_end TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### System Operations Tables

#### feed_sync_log
Feed synchronization history with automatic cleanup.

```sql
CREATE TABLE feed_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    sync_started_at TIMESTAMPTZ DEFAULT NOW(),
    sync_completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'in_progress',
    http_status_code INTEGER,
    error_message TEXT,
    articles_found INTEGER,
    articles_new INTEGER,
    etag_header TEXT,
    last_modified_header TEXT,
    sync_duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Automatic Cleanup:** Trigger maintains only the last 100 logs per feed.

#### cleanup_log
Article cleanup operation history and monitoring.

```sql
CREATE TABLE cleanup_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    feed_id UUID REFERENCES feeds(id) ON DELETE SET NULL,
    trigger_type TEXT NOT NULL, -- 'sync', 'scheduled', 'manual'
    articles_deleted INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cleanup_log_user_id ON cleanup_log(user_id);
CREATE INDEX idx_cleanup_log_created_at ON cleanup_log(created_at);
```

**Key Features:**
- Tracks all cleanup operations (sync-triggered, scheduled, manual)
- Records articles deleted count and operation duration
- Stores error messages for failed cleanups
- Indexed for efficient querying by user and date
- Used for admin monitoring and statistics

**Trigger Types:**
- `sync`: Cleanup triggered after feed sync
- `scheduled`: Cleanup triggered by daily scheduled job
- `manual`: Cleanup triggered manually by admin

#### ai_usage
Daily AI operation tracking and limits.

```sql
CREATE TABLE ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    summary_count INTEGER DEFAULT 0,
    clustering_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT ai_usage_user_date_unique UNIQUE(user_id, usage_date)
);
```

#### digest_history
Email digest delivery tracking.

```sql
CREATE TABLE digest_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivery_method TEXT DEFAULT 'email',
    article_ids UUID[],
    digest_summary TEXT,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Database Views

### articles_with_feed
Articles joined with feed metadata for efficient querying.

```sql
CREATE VIEW articles_with_feed AS
SELECT 
    a.*,
    f.name as feed_name,
    f.url as feed_url,
    f.site_url as feed_site_url,
    f.icon_url as feed_icon_url,
    f.status as feed_status,
    f.user_id as feed_user_id
FROM articles a
JOIN feeds f ON a.feed_id = f.id;
```

### user_article_feed
Complete user reading interface with article and feed data.

```sql
CREATE VIEW user_article_feed AS
SELECT 
    ua.user_id,
    ua.article_id,
    ua.is_read,
    ua.read_at,
    ua.is_starred,
    ua.starred_at,
    ua.clicked_at,
    ua.time_spent_seconds,
    a.title,
    a.url,
    a.author,
    a.excerpt,
    a.published_at,
    a.ai_summary,
    f.id as feed_id,
    f.name as feed_name,
    f.icon_url as feed_icon_url,
    f.folder_id
FROM user_articles ua
JOIN articles a ON ua.article_id = a.id
JOIN feeds f ON a.feed_id = f.id;
```

### folder_unread_counts
Unread article counts by folder for navigation.

```sql
CREATE VIEW folder_unread_counts AS
SELECT 
    f.user_id,
    f.id as folder_id,
    f.name as folder_name,
    COUNT(a.id) as total_count,
    COUNT(a.id) FILTER (WHERE ua.is_read IS NULL OR ua.is_read = FALSE) as unread_count
FROM folders f
LEFT JOIN feeds fd ON f.id = fd.folder_id
LEFT JOIN articles a ON fd.id = a.feed_id
LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = f.user_id
GROUP BY f.user_id, f.id, f.name;
```

### feed_stats
Per-feed statistics and health metrics.

```sql
CREATE VIEW feed_stats AS
SELECT 
    f.id as feed_id,
    f.user_id,
    f.name,
    f.status,
    COUNT(a.id) as article_count,
    COUNT(a.id) FILTER (WHERE ua.is_read IS NULL OR ua.is_read = FALSE) as unread_count,
    MAX(a.published_at) as last_article_date,
    f.last_fetched_at,
    (SELECT COUNT(*) FROM feed_sync_log fsl WHERE fsl.feed_id = f.id AND fsl.status = 'error' AND fsl.created_at > NOW() - INTERVAL '24 hours') as recent_errors
FROM feeds f
LEFT JOIN articles a ON f.id = a.feed_id
LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = f.user_id
GROUP BY f.id, f.user_id, f.name, f.status, f.last_fetched_at;
```

## Functions and Procedures

### User Management Functions

#### handle_new_user()
Automatically creates profile when user signs up.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            split_part(NEW.email, '@', 1)
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Article Management Functions

#### calculate_relevancy_score(article_id, user_id, interests)
Calculates article relevancy based on user interests and reading patterns.

```sql
CREATE OR REPLACE FUNCTION calculate_relevancy_score(
    p_article_id UUID,
    p_user_id UUID,
    p_user_interests TEXT[]
) RETURNS INTEGER AS $$
DECLARE
    base_score INTEGER := 50;
    interest_boost INTEGER := 0;
    recency_boost INTEGER := 0;
    engagement_boost INTEGER := 0;
BEGIN
    -- Interest matching boost
    SELECT CASE 
        WHEN array_length(p_user_interests, 1) > 0 THEN 20
        ELSE 0
    END INTO interest_boost;
    
    -- Recency boost (newer articles score higher)
    SELECT CASE 
        WHEN published_at > NOW() - INTERVAL '1 day' THEN 15
        WHEN published_at > NOW() - INTERVAL '3 days' THEN 10
        WHEN published_at > NOW() - INTERVAL '7 days' THEN 5
        ELSE 0
    END INTO recency_boost
    FROM articles WHERE id = p_article_id;
    
    -- Engagement boost (from same feed if user engages)
    SELECT CASE 
        WHEN COUNT(*) > 0 THEN 10
        ELSE 0
    END INTO engagement_boost
    FROM user_articles ua
    JOIN articles a ON ua.article_id = a.id
    JOIN articles target ON a.feed_id = target.feed_id
    WHERE target.id = p_article_id
    AND ua.user_id = p_user_id
    AND (ua.is_starred = TRUE OR ua.time_spent_seconds > 60);
    
    RETURN LEAST(100, base_score + interest_boost + recency_boost + engagement_boost);
END;
$$ LANGUAGE plpgsql;
```

#### mark_folder_read(user_id, folder_id)
Bulk operation to mark all articles in a folder as read.

```sql
CREATE OR REPLACE FUNCTION mark_folder_read(
    p_user_id UUID,
    p_folder_id UUID
) RETURNS INTEGER AS $$
DECLARE
    articles_marked INTEGER;
BEGIN
    WITH folder_articles AS (
        SELECT a.id as article_id
        FROM articles a
        JOIN feeds f ON a.feed_id = f.id
        WHERE f.user_id = p_user_id
        AND f.folder_id = p_folder_id
    )
    INSERT INTO user_articles (user_id, article_id, is_read, read_at)
    SELECT p_user_id, fa.article_id, TRUE, NOW()
    FROM folder_articles fa
    ON CONFLICT (user_id, article_id) 
    DO UPDATE SET 
        is_read = TRUE,
        read_at = NOW(),
        updated_at = NOW();
    
    GET DIAGNOSTICS articles_marked = ROW_COUNT;
    RETURN articles_marked;
END;
$$ LANGUAGE plpgsql;
```

### Feed Sync Functions

#### start_feed_sync(feed_id)
Initiates a feed synchronization log entry.

```sql
CREATE OR REPLACE FUNCTION start_feed_sync(p_feed_id UUID)
RETURNS UUID AS $$
DECLARE
    sync_log_id UUID;
BEGIN
    INSERT INTO feed_sync_log (feed_id, sync_started_at, status)
    VALUES (p_feed_id, NOW(), 'in_progress')
    RETURNING id INTO sync_log_id;
    
    RETURN sync_log_id;
END;
$$ LANGUAGE plpgsql;
```

#### complete_feed_sync_success(sync_id, ...)
Completes a successful feed synchronization.

```sql
CREATE OR REPLACE FUNCTION complete_feed_sync_success(
    p_sync_id UUID,
    p_http_status INTEGER,
    p_articles_found INTEGER,
    p_articles_new INTEGER,
    p_articles_updated INTEGER,
    p_etag TEXT,
    p_last_modified TEXT,
    p_duration_ms INTEGER
) RETURNS VOID AS $$
BEGIN
    UPDATE feed_sync_log SET
        sync_completed_at = NOW(),
        status = 'success',
        http_status_code = p_http_status,
        articles_found = p_articles_found,
        articles_new = p_articles_new,
        etag_header = p_etag,
        last_modified_header = p_last_modified,
        sync_duration_ms = p_duration_ms
    WHERE id = p_sync_id;
END;
$$ LANGUAGE plpgsql;
```

### Vector Search Functions (Optional)

#### find_similar_articles(embedding, threshold, limit)
Finds articles similar to given embedding using cosine similarity.

```sql
CREATE OR REPLACE FUNCTION find_similar_articles(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.5,
    result_limit INTEGER DEFAULT 10
) RETURNS TABLE(
    article_id UUID,
    title TEXT,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        cosine_similarity(a.embedding, query_embedding) as similarity
    FROM articles a
    WHERE a.embedding IS NOT NULL
    AND cosine_similarity(a.embedding, query_embedding) > similarity_threshold
    ORDER BY similarity DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
```

## Indexes and Performance

### Primary Indexes

```sql
-- Foreign key indexes for performance
CREATE INDEX idx_profiles_id ON profiles(id);
CREATE INDEX idx_feeds_user_id ON feeds(user_id);
CREATE INDEX idx_feeds_folder_id ON feeds(folder_id);
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_cluster_id ON articles(cluster_id);
CREATE INDEX idx_user_articles_user_id ON user_articles(user_id);
CREATE INDEX idx_user_articles_article_id ON user_articles(article_id);

-- Query optimization indexes
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_fetched_at ON articles(fetched_at DESC);
CREATE INDEX idx_feeds_status ON feeds(status) WHERE status = 'active';
CREATE INDEX idx_feeds_last_fetched ON feeds(last_fetched_at);

-- Composite indexes for common queries
CREATE INDEX idx_user_articles_read_status ON user_articles(user_id, is_read, read_at);
CREATE INDEX idx_user_articles_starred ON user_articles(user_id, is_starred) WHERE is_starred = TRUE;
CREATE INDEX idx_articles_feed_published ON articles(feed_id, published_at DESC);

-- Cleanup system indexes
CREATE INDEX idx_articles_feed_published ON articles(feed_id, published_at DESC);
CREATE INDEX idx_user_articles_protection ON user_articles(user_id, article_id) 
    WHERE is_starred = TRUE OR is_read = TRUE;
CREATE INDEX idx_cleanup_log_user_id ON cleanup_log(user_id);
CREATE INDEX idx_cleanup_log_created_at ON cleanup_log(created_at);

-- RLS performance indexes
CREATE INDEX idx_feeds_user_id_rls ON feeds(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_articles_user_id_rls ON user_articles(user_id) WHERE user_id IS NOT NULL;

-- Vector search indexes (if pgvector available)
CREATE INDEX idx_articles_embedding_cosine ON articles USING ivfflat (embedding vector_cosine_ops);
```

### Partial Indexes

```sql
-- Only index active feeds
CREATE INDEX idx_feeds_active_status ON feeds(user_id, status) WHERE status = 'active';

-- Only index unread articles
CREATE INDEX idx_user_articles_unread ON user_articles(user_id, article_id) WHERE is_read = FALSE;

-- Only index articles with AI summaries
CREATE INDEX idx_articles_ai_summary ON articles(feed_id) WHERE ai_summary IS NOT NULL;
```

## Row Level Security (RLS)

### Policy Overview

All user-specific tables have RLS enabled with policies ensuring users can only access their own data.

### Example Policies

```sql
-- Profiles: Users can only see their own profile
CREATE POLICY profiles_own_data ON profiles
    FOR ALL USING (auth.uid() = id);

-- Feeds: Users can only manage their own feeds
CREATE POLICY feeds_own_data ON feeds
    FOR ALL USING (auth.uid() = user_id);

-- Articles: Users can only see articles from their subscribed feeds
CREATE POLICY articles_subscribed_feeds ON articles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM feeds f 
            WHERE f.id = articles.feed_id 
            AND f.user_id = auth.uid()
        )
    );

-- Recommended feeds: Public read access
CREATE POLICY recommended_feeds_public_read ON recommended_feeds
    FOR SELECT USING (true);
```

### Helper Functions

```sql
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    SELECT COALESCE(
        current_setting('request.jwt.claims', true)::json->>'sub',
        (current_setting('request.jwt.claims', true)::json->>'user_id')
    )::uuid;
$$ LANGUAGE sql STABLE;
```

## Common Query Patterns

### User Dashboard Queries

#### Get User's Unread Article Count
```sql
SELECT COUNT(*) as unread_count
FROM articles a
JOIN feeds f ON a.feed_id = f.id
LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = f.user_id
WHERE f.user_id = $1
AND (ua.is_read IS NULL OR ua.is_read = FALSE);
```

#### Get Folder Structure with Unread Counts
```sql
SELECT 
    f.id,
    f.name,
    f.icon,
    COALESCE(fuc.unread_count, 0) as unread_count,
    COALESCE(fuc.total_count, 0) as total_count
FROM folders f
LEFT JOIN folder_unread_counts fuc ON f.id = fuc.folder_id
WHERE f.user_id = $1
ORDER BY f.position, f.name;
```

### Feed Management Queries

#### Get Active Feeds for Synchronization
```sql
SELECT 
    f.id,
    f.url,
    f.etag,
    f.last_modified,
    f.custom_polling_interval,
    f.priority,
    f.last_fetched_at
FROM feeds f
WHERE f.status = 'active'
AND (
    f.last_fetched_at IS NULL 
    OR f.last_fetched_at < NOW() - INTERVAL '1 hour' * 
        CASE f.priority
            WHEN 'high' THEN 0.5
            WHEN 'medium' THEN 1
            WHEN 'low' THEN 2
        END
)
ORDER BY f.priority DESC, f.last_fetched_at ASC NULLS FIRST;
```

#### Get Feed Health Status
```sql
SELECT 
    f.id,
    f.name,
    f.status,
    f.last_fetched_at,
    fs.recent_errors,
    fs.article_count,
    fs.last_article_date
FROM feeds f
JOIN feed_stats fs ON f.id = fs.feed_id
WHERE f.user_id = $1
ORDER BY fs.recent_errors DESC, f.last_fetched_at ASC;
```

### Article Reading Queries

#### Get User's Reading Feed
```sql
SELECT 
    uaf.*,
    c.title as cluster_title,
    c.summary as cluster_summary
FROM user_article_feed uaf
LEFT JOIN clusters c ON uaf.article_id IN (
    SELECT a.id FROM articles a WHERE a.cluster_id = c.id
)
WHERE uaf.user_id = $1
AND ($2 IS NULL OR uaf.is_read = $2)  -- Optional read filter
AND ($3 IS NULL OR uaf.folder_id = $3)  -- Optional folder filter
ORDER BY 
    CASE WHEN uaf.is_starred THEN 0 ELSE 1 END,
    uaf.published_at DESC
LIMIT $4 OFFSET $5;
```

#### Mark Article as Read
```sql
INSERT INTO user_articles (user_id, article_id, is_read, read_at)
VALUES ($1, $2, TRUE, NOW())
ON CONFLICT (user_id, article_id)
DO UPDATE SET 
    is_read = TRUE,
    read_at = NOW(),
    updated_at = NOW();
```

### Article Cleanup Queries

#### Get Protected Articles for User
```sql
-- Get all protected article IDs (starred, read, or commented)
SELECT DISTINCT ua.article_id
FROM user_articles ua
WHERE ua.user_id = $1
AND (ua.is_starred = TRUE OR ua.is_read = TRUE)

UNION

SELECT DISTINCT ac.article_id
FROM article_comments ac
WHERE ac.user_id = $1;
```

#### Get Articles Exceeding Per-Feed Limit
```sql
-- Get article IDs to delete based on per-feed limit
WITH ranked_articles AS (
    SELECT 
        a.id,
        a.feed_id,
        a.published_at,
        ROW_NUMBER() OVER (
            PARTITION BY a.feed_id 
            ORDER BY a.published_at DESC
        ) as rank
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = f.user_id
    WHERE f.user_id = $1
    AND f.id = $2
    AND (ua.is_read IS NULL OR ua.is_read = FALSE)
    AND (ua.is_starred IS NULL OR ua.is_starred = FALSE)
    AND a.id NOT IN (
        SELECT article_id FROM article_comments WHERE user_id = $1
    )
)
SELECT id
FROM ranked_articles
WHERE rank > $3  -- articles_per_feed limit
ORDER BY published_at ASC;
```

#### Get Articles Exceeding Age Threshold
```sql
-- Get article IDs to delete based on age threshold
SELECT a.id
FROM articles a
JOIN feeds f ON a.feed_id = f.id
LEFT JOIN user_articles ua ON a.id = ua.article_id AND ua.user_id = f.user_id
WHERE f.user_id = $1
AND f.id = $2
AND a.published_at < NOW() - INTERVAL '1 day' * $3  -- unread_article_age_days
AND (ua.is_read IS NULL OR ua.is_read = FALSE)
AND (ua.is_starred IS NULL OR ua.is_starred = FALSE)
AND a.id NOT IN (
    SELECT article_id FROM article_comments WHERE user_id = $1
)
ORDER BY a.published_at ASC;
```

#### Get Cleanup Statistics
```sql
-- Get aggregate cleanup statistics
SELECT 
    COUNT(*) as total_cleanups,
    SUM(articles_deleted) as total_articles_deleted,
    AVG(duration_ms) as average_duration,
    SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as error_rate,
    (
        SELECT COUNT(*) 
        FROM cleanup_log 
        WHERE created_at > NOW() - INTERVAL '24 hours'
    ) as cleanups_last_24h,
    (
        SELECT SUM(articles_deleted) 
        FROM cleanup_log 
        WHERE created_at > NOW() - INTERVAL '24 hours'
    ) as articles_deleted_last_24h
FROM cleanup_log;
```

#### Get Cleanup Logs with Pagination
```sql
-- Get paginated cleanup logs with optional filters
SELECT 
    cl.id,
    cl.user_id,
    cl.feed_id,
    cl.trigger_type,
    cl.articles_deleted,
    cl.duration_ms,
    cl.error_message,
    cl.created_at,
    p.display_name as user_name,
    f.name as feed_name
FROM cleanup_log cl
LEFT JOIN profiles p ON cl.user_id = p.id
LEFT JOIN feeds f ON cl.feed_id = f.id
WHERE ($1::UUID IS NULL OR cl.user_id = $1)
AND ($2::TEXT IS NULL OR cl.trigger_type = $2)
AND ($3::BOOLEAN IS NULL OR (cl.error_message IS NOT NULL) = $3)
ORDER BY cl.created_at DESC
LIMIT $4 OFFSET $5;
```

### AI and Clustering Queries

#### Get Articles for AI Processing
```sql
SELECT 
    a.id,
    a.title,
    a.content,
    a.published_at,
    f.user_id
FROM articles a
JOIN feeds f ON a.feed_id = f.id
WHERE a.ai_summary IS NULL
AND a.content IS NOT NULL
AND LENGTH(a.content) > 100
AND a.published_at > NOW() - INTERVAL '7 days'
ORDER BY a.published_at DESC
LIMIT 100;
```

#### Get Trending Clusters
```sql
SELECT 
    c.id,
    c.title,
    c.summary,
    c.article_count,
    c.timeframe_start,
    c.timeframe_end,
    COUNT(DISTINCT a.feed_id) as source_count
FROM clusters c
JOIN articles a ON c.id = a.cluster_id
JOIN feeds f ON a.feed_id = f.id
WHERE c.expires_at > NOW()
AND c.article_count >= 3
GROUP BY c.id, c.title, c.summary, c.article_count, c.timeframe_start, c.timeframe_end
ORDER BY c.article_count DESC, c.timeframe_end DESC
LIMIT 20;
```

## Application Integration

### Connection Configuration

#### Environment Variables
```bash
DATABASE_URL=postgresql://postgres:password@localhost:54322/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Connection Pool Settings
```javascript
// Recommended connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Authentication Integration

#### Setting User Context for RLS
```javascript
// Set user context for RLS policies
await client.query(
  "SELECT set_config('request.jwt.claims', $1, true)",
  [JSON.stringify({ sub: userId })]
);
```

#### Clearing User Context
```javascript
// Clear user context
await client.query(
  "SELECT set_config('request.jwt.claims', '', true)"
);
```

### Error Handling

#### Common Error Patterns
```javascript
try {
  await client.query(query, params);
} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation
    throw new Error('Duplicate entry');
  } else if (error.code === '23503') {
    // Foreign key constraint violation
    throw new Error('Referenced record not found');
  } else if (error.code === '42501') {
    // Insufficient privilege (RLS)
    throw new Error('Access denied');
  }
  throw error;
}
```

### Performance Best Practices

#### Query Optimization
1. **Use prepared statements** for repeated queries
2. **Limit result sets** with LIMIT and OFFSET
3. **Use indexes effectively** by matching WHERE clauses to index columns
4. **Avoid N+1 queries** by using JOINs or batch operations
5. **Use views** for complex, repeated query patterns

#### Connection Management
1. **Use connection pooling** to manage database connections
2. **Set appropriate timeouts** for queries and connections
3. **Monitor connection usage** and adjust pool size as needed
4. **Close connections properly** to prevent leaks

## Backup and Maintenance

### Backup Strategy

#### Daily Automated Backups
```bash
# Full database backup
pg_dump -h localhost -p 54322 -U postgres -d postgres \
  --format=custom --compress=9 \
  --file=cronkite_backup_$(date +%Y%m%d).dump

# Schema-only backup
pg_dump -h localhost -p 54322 -U postgres -d postgres \
  --schema-only --format=plain \
  --file=cronkite_schema_$(date +%Y%m%d).sql
```

#### Selective Table Backups
```bash
# Backup user data only
pg_dump -h localhost -p 54322 -U postgres -d postgres \
  --format=custom \
  --table=profiles --table=user_settings --table=user_interests \
  --table=folders --table=feeds --table=user_articles \
  --file=cronkite_userdata_$(date +%Y%m%d).dump
```

### Maintenance Tasks

#### Weekly Maintenance
```sql
-- Update table statistics
ANALYZE;

-- Reindex if needed
REINDEX DATABASE postgres;

-- Clean up old clusters
DELETE FROM clusters WHERE expires_at < NOW() - INTERVAL '1 day';

-- Clean up old sync logs (handled automatically by trigger)
-- Manual cleanup if needed:
-- DELETE FROM feed_sync_log WHERE created_at < NOW() - INTERVAL '30 days';
```

#### Monthly Maintenance
```sql
-- Vacuum full for space reclamation (during maintenance window)
VACUUM FULL;

-- Update extension if available
-- ALTER EXTENSION vector UPDATE;

-- Check for unused indexes
SELECT 
    schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0 
ORDER BY schemaname, tablename;
```

### Monitoring Queries

#### Database Size Monitoring
```sql
SELECT 
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT COUNT(*) FROM feeds) as total_feeds,
    (SELECT COUNT(*) FROM articles) as total_articles;
```

#### Performance Monitoring
```sql
-- Slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE mean_time > 100 
ORDER BY mean_time DESC 
LIMIT 10;

-- Index usage
SELECT 
    schemaname, tablename, indexname,
    idx_tup_read, idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexname)) as size
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC 
LIMIT 20;
```

#### Connection Monitoring
```sql
SELECT 
    state,
    COUNT(*) as connection_count,
    MAX(now() - state_change) as max_duration
FROM pg_stat_activity 
WHERE datname = current_database()
GROUP BY state;
```

---

## Conclusion

This documentation provides a comprehensive guide to the Cronkite database schema. The schema is designed for scalability, performance, and security, with proper indexing, RLS policies, and maintenance procedures.

For additional support or questions about the database schema, refer to the migration files in `/supabase/migrations/` and the test files in `/supabase/tests/` for practical examples of usage patterns.

**Last Updated:** December 2024  
**Schema Version:** 1.0  
**PostgreSQL Version:** 17+  
**Supabase Compatible:** Yes