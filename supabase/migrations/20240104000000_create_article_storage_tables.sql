-- Create article storage and AI features tables
-- Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 9.1, 9.3, 9.4, 9.5

-- Enable pgvector extension for semantic search (if available)
-- Requirements: 15.1, 15.2, 15.4
CREATE EXTENSION IF NOT EXISTS vector;

-- Create clusters table for AI topic grouping first (referenced by articles)
-- Requirements: 9.1, 9.3, 9.4, 9.5

CREATE TABLE IF NOT EXISTS clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  article_count INTEGER NOT NULL DEFAULT 0,
  source_feeds TEXT[] DEFAULT '{}',
  timeframe_start TIMESTAMPTZ,
  timeframe_end TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create articles table with AI enhancement fields
-- Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6

CREATE TABLE IF NOT EXISTS articles (
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
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai_summary TEXT,
  ai_summary_generated_at TIMESTAMPTZ,
  embedding VECTOR(1536), -- 1536-dimensional embeddings for OpenAI compatibility
  cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint on (feed_id, guid) to prevent duplicates
  UNIQUE(feed_id, guid)
);

-- Create user_articles table for reading state
-- Requirements: 5.1, 5.2, 5.3, 5.4, 5.5

CREATE TABLE IF NOT EXISTS user_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  starred_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  time_spent_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint on (user_id, article_id) to ensure one record per user-article pair
  UNIQUE(user_id, article_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_guid ON articles(feed_id, guid);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_fetched_at ON articles(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_cluster_id ON articles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_articles_ai_summary ON articles(ai_summary_generated_at) WHERE ai_summary IS NOT NULL;

-- Create vector similarity index for semantic search (if pgvector is available)
CREATE INDEX IF NOT EXISTS idx_articles_embedding ON articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_user_articles_user_id ON user_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_articles_article_id ON user_articles(article_id);
CREATE INDEX IF NOT EXISTS idx_user_articles_read_status ON user_articles(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_user_articles_starred ON user_articles(user_id, is_starred) WHERE is_starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_articles_read_at ON user_articles(read_at DESC) WHERE read_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clusters_timeframe ON clusters(timeframe_start, timeframe_end);
CREATE INDEX IF NOT EXISTS idx_clusters_expires_at ON clusters(expires_at);
CREATE INDEX IF NOT EXISTS idx_clusters_article_count ON clusters(article_count DESC);

-- Enable Row Level Security on all tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for articles table
-- Users can only see articles from feeds they subscribe to
CREATE POLICY "Users can view articles from subscribed feeds" ON articles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feeds 
      WHERE feeds.id = articles.feed_id 
      AND feeds.user_id = auth.uid()
    )
  );

-- Create RLS policies for user_articles table
CREATE POLICY "Users can view own article states" ON user_articles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own article states" ON user_articles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own article states" ON user_articles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own article states" ON user_articles
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for clusters table
-- Users can see clusters that contain articles from their subscribed feeds
CREATE POLICY "Users can view relevant clusters" ON clusters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM articles 
      JOIN feeds ON articles.feed_id = feeds.id
      WHERE articles.cluster_id = clusters.id 
      AND feeds.user_id = auth.uid()
    )
  );

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER update_user_articles_updated_at
  BEFORE UPDATE ON user_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clusters_updated_at
  BEFORE UPDATE ON clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically update cluster article count
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
      -- Decrease count for old cluster
      IF OLD.cluster_id IS NOT NULL THEN
        UPDATE clusters 
        SET article_count = article_count - 1,
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
    UPDATE clusters 
    SET article_count = article_count - 1,
        updated_at = NOW()
    WHERE id = OLD.cluster_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain cluster article counts
CREATE TRIGGER maintain_cluster_article_count
  AFTER INSERT OR UPDATE OR DELETE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_cluster_article_count();

-- Create function to automatically set timestamps on user_articles
CREATE OR REPLACE FUNCTION update_user_article_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set read_at when is_read becomes true
  IF NEW.is_read = TRUE AND (OLD.is_read IS NULL OR OLD.is_read = FALSE) THEN
    NEW.read_at = NOW();
  ELSIF NEW.is_read = FALSE THEN
    NEW.read_at = NULL;
  END IF;
  
  -- Set starred_at when is_starred becomes true
  IF NEW.is_starred = TRUE AND (OLD.is_starred IS NULL OR OLD.is_starred = FALSE) THEN
    NEW.starred_at = NOW();
  ELSIF NEW.is_starred = FALSE THEN
    NEW.starred_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically manage user article timestamps
CREATE TRIGGER update_user_article_timestamps_trigger
  BEFORE INSERT OR UPDATE ON user_articles
  FOR EACH ROW EXECUTE FUNCTION update_user_article_timestamps();

-- Create function to increment feed article count when articles are added
CREATE OR REPLACE FUNCTION update_feed_article_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feeds 
    SET article_count = article_count + 1,
        updated_at = NOW()
    WHERE id = NEW.feed_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feeds 
    SET article_count = article_count - 1,
        updated_at = NOW()
    WHERE id = OLD.feed_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain feed article counts
CREATE TRIGGER maintain_feed_article_count
  AFTER INSERT OR DELETE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_feed_article_count();