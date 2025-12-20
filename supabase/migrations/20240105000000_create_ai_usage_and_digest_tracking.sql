-- Create AI usage and digest tracking tables
-- Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5

-- Create ai_usage table for daily limits
-- Requirements: 10.1, 10.2, 10.3, 10.4, 10.5

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  summary_count INTEGER NOT NULL DEFAULT 0,
  clustering_count INTEGER NOT NULL DEFAULT 0,
  total_operations INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Unique constraint on (user_id, usage_date) to ensure one record per user per day
  UNIQUE(user_id, usage_date)
);

-- Create digest_history table for email tracking
-- Requirements: 11.1, 11.2, 11.3, 11.4, 11.5

CREATE TABLE IF NOT EXISTS digest_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  digest_type TEXT NOT NULL DEFAULT 'daily', -- 'daily', 'weekly', 'custom'
  delivery_method TEXT NOT NULL DEFAULT 'email', -- 'email', 'push', 'in-app'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  article_ids UUID[] NOT NULL DEFAULT '{}', -- Array of article IDs included in digest
  article_count INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT, -- AI-generated digest summary
  opened_at TIMESTAMPTZ, -- When user opened the digest
  clicked_at TIMESTAMPTZ, -- When user clicked through from digest
  click_count INTEGER NOT NULL DEFAULT 0, -- Number of article clicks from digest
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_usage_date ON ai_usage(usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, usage_date);

CREATE INDEX IF NOT EXISTS idx_digest_history_user_id ON digest_history(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_history_sent_at ON digest_history(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_history_digest_type ON digest_history(digest_type);
CREATE INDEX IF NOT EXISTS idx_digest_history_delivery_method ON digest_history(delivery_method);
CREATE INDEX IF NOT EXISTS idx_digest_history_article_ids ON digest_history USING GIN(article_ids);

-- Enable Row Level Security on all tables
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_usage table
CREATE POLICY "Users can view own AI usage" ON ai_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI usage" ON ai_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI usage" ON ai_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for digest_history table
CREATE POLICY "Users can view own digest history" ON digest_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own digest history" ON digest_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own digest history" ON digest_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER update_ai_usage_updated_at
  BEFORE UPDATE ON ai_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_digest_history_updated_at
  BEFORE UPDATE ON digest_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to increment AI usage counters (UPSERT behavior)
-- Requirements: 10.1, 10.2, 10.3

CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id UUID,
  p_operation_type TEXT, -- 'summary' or 'clustering'
  p_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  current_date DATE := CURRENT_DATE;
BEGIN
  -- Insert or update AI usage record for today
  INSERT INTO ai_usage (
    user_id,
    usage_date,
    summary_count,
    clustering_count,
    total_operations
  ) VALUES (
    p_user_id,
    current_date,
    CASE WHEN p_operation_type = 'summary' THEN p_increment ELSE 0 END,
    CASE WHEN p_operation_type = 'clustering' THEN p_increment ELSE 0 END,
    p_increment
  )
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    summary_count = ai_usage.summary_count + 
      CASE WHEN p_operation_type = 'summary' THEN p_increment ELSE 0 END,
    clustering_count = ai_usage.clustering_count + 
      CASE WHEN p_operation_type = 'clustering' THEN p_increment ELSE 0 END,
    total_operations = ai_usage.total_operations + p_increment,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get current AI usage for a user
-- Requirements: 10.4, 10.5

CREATE OR REPLACE FUNCTION get_ai_usage_today(p_user_id UUID)
RETURNS TABLE(
  summary_count INTEGER,
  clustering_count INTEGER,
  total_operations INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(au.summary_count, 0) as summary_count,
    COALESCE(au.clustering_count, 0) as clustering_count,
    COALESCE(au.total_operations, 0) as total_operations
  FROM ai_usage au
  WHERE au.user_id = p_user_id 
    AND au.usage_date = CURRENT_DATE
  UNION ALL
  SELECT 0, 0, 0
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_usage au
    WHERE au.user_id = p_user_id 
      AND au.usage_date = CURRENT_DATE
  )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update digest engagement metrics
-- Requirements: 11.3, 11.4

CREATE OR REPLACE FUNCTION update_digest_engagement(
  p_digest_id UUID,
  p_action TEXT, -- 'opened', 'clicked'
  p_click_increment INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  IF p_action = 'opened' THEN
    UPDATE digest_history 
    SET 
      opened_at = COALESCE(opened_at, NOW()),
      updated_at = NOW()
    WHERE id = p_digest_id;
  ELSIF p_action = 'clicked' THEN
    UPDATE digest_history 
    SET 
      clicked_at = COALESCE(clicked_at, NOW()),
      click_count = click_count + p_click_increment,
      updated_at = NOW()
    WHERE id = p_digest_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to automatically set article_count from article_ids array
-- Requirements: 11.1, 11.2

CREATE OR REPLACE FUNCTION update_digest_article_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically set article_count based on array length
  NEW.article_count = array_length(NEW.article_ids, 1);
  IF NEW.article_count IS NULL THEN
    NEW.article_count = 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update article count
CREATE TRIGGER update_digest_article_count_trigger
  BEFORE INSERT OR UPDATE ON digest_history
  FOR EACH ROW EXECUTE FUNCTION update_digest_article_count();