-- Create AI usage tracking tables for embeddings and clustering
-- Requirements: 8.1, 8.5

-- Create ai_usage_log table for detailed API call tracking
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  operation TEXT NOT NULL CHECK (operation IN ('embedding', 'clustering', 'search', 'summary')),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  model TEXT,
  token_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  request_metadata JSONB,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create ai_usage_daily table for aggregated daily usage
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  embeddings_count INTEGER NOT NULL DEFAULT 0,
  clusterings_count INTEGER NOT NULL DEFAULT 0,
  searches_count INTEGER NOT NULL DEFAULT 0,
  summaries_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  openai_tokens INTEGER NOT NULL DEFAULT 0,
  anthropic_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  -- Daily limits (configurable per user)
  embeddings_limit INTEGER NOT NULL DEFAULT 500,
  clusterings_limit INTEGER NOT NULL DEFAULT 10,
  searches_limit INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Create indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_date ON ai_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_operation ON ai_usage_log(operation, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_provider ON ai_usage_log(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created ON ai_usage_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_user ON ai_usage_daily(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_date ON ai_usage_daily(date DESC);

-- Enable Row Level Security
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_usage_log
CREATE POLICY "Users can view own usage logs" ON ai_usage_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert usage logs" ON ai_usage_log
  FOR INSERT WITH CHECK (true);

-- Create RLS policies for ai_usage_daily
CREATE POLICY "Users can view own daily usage" ON ai_usage_daily
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage daily usage" ON ai_usage_daily
  FOR ALL USING (true);

-- Create trigger to update updated_at on ai_usage_daily
CREATE TRIGGER update_ai_usage_daily_updated_at
  BEFORE UPDATE ON ai_usage_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to record API usage
-- Requirements: 8.1, 8.5
CREATE OR REPLACE FUNCTION record_ai_usage(
  p_user_id UUID,
  p_operation TEXT,
  p_provider TEXT,
  p_model TEXT DEFAULT NULL,
  p_token_count INTEGER DEFAULT 0,
  p_input_tokens INTEGER DEFAULT NULL,
  p_output_tokens INTEGER DEFAULT NULL,
  p_estimated_cost DECIMAL DEFAULT 0,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_latency_ms INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
  current_date DATE := CURRENT_DATE;
BEGIN
  -- Insert into usage log
  INSERT INTO ai_usage_log (
    user_id, operation, provider, model, token_count, 
    input_tokens, output_tokens, estimated_cost, 
    success, error_message, latency_ms, request_metadata
  ) VALUES (
    p_user_id, p_operation, p_provider, p_model, p_token_count,
    p_input_tokens, p_output_tokens, p_estimated_cost,
    p_success, p_error_message, p_latency_ms, p_metadata
  ) RETURNING id INTO log_id;
  
  -- Update daily aggregates
  INSERT INTO ai_usage_daily (
    user_id, date,
    embeddings_count, clusterings_count, searches_count, summaries_count,
    total_tokens, openai_tokens, anthropic_tokens, estimated_cost
  ) VALUES (
    p_user_id, current_date,
    CASE WHEN p_operation = 'embedding' THEN 1 ELSE 0 END,
    CASE WHEN p_operation = 'clustering' THEN 1 ELSE 0 END,
    CASE WHEN p_operation = 'search' THEN 1 ELSE 0 END,
    CASE WHEN p_operation = 'summary' THEN 1 ELSE 0 END,
    p_token_count,
    CASE WHEN p_provider = 'openai' THEN p_token_count ELSE 0 END,
    CASE WHEN p_provider = 'anthropic' THEN p_token_count ELSE 0 END,
    p_estimated_cost
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    embeddings_count = ai_usage_daily.embeddings_count + 
      CASE WHEN p_operation = 'embedding' THEN 1 ELSE 0 END,
    clusterings_count = ai_usage_daily.clusterings_count + 
      CASE WHEN p_operation = 'clustering' THEN 1 ELSE 0 END,
    searches_count = ai_usage_daily.searches_count + 
      CASE WHEN p_operation = 'search' THEN 1 ELSE 0 END,
    summaries_count = ai_usage_daily.summaries_count + 
      CASE WHEN p_operation = 'summary' THEN 1 ELSE 0 END,
    total_tokens = ai_usage_daily.total_tokens + p_token_count,
    openai_tokens = ai_usage_daily.openai_tokens + 
      CASE WHEN p_provider = 'openai' THEN p_token_count ELSE 0 END,
    anthropic_tokens = ai_usage_daily.anthropic_tokens + 
      CASE WHEN p_provider = 'anthropic' THEN p_token_count ELSE 0 END,
    estimated_cost = ai_usage_daily.estimated_cost + p_estimated_cost,
    updated_at = NOW();
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user can make API request
-- Requirements: 8.2, 8.3, 8.4
CREATE OR REPLACE FUNCTION can_make_ai_request(
  p_user_id UUID,
  p_operation TEXT
)
RETURNS TABLE(
  allowed BOOLEAN,
  current_count INTEGER,
  daily_limit INTEGER,
  remaining INTEGER
) AS $$
DECLARE
  usage_record ai_usage_daily%ROWTYPE;
  op_count INTEGER;
  op_limit INTEGER;
BEGIN
  -- Get or create today's usage record
  SELECT * INTO usage_record
  FROM ai_usage_daily
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  -- If no record exists, user can make request
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      true::BOOLEAN as allowed,
      0::INTEGER as current_count,
      CASE p_operation
        WHEN 'embedding' THEN 500
        WHEN 'clustering' THEN 10
        WHEN 'search' THEN 100
        ELSE 100
      END::INTEGER as daily_limit,
      CASE p_operation
        WHEN 'embedding' THEN 500
        WHEN 'clustering' THEN 10
        WHEN 'search' THEN 100
        ELSE 100
      END::INTEGER as remaining;
    RETURN;
  END IF;
  
  -- Get current count and limit based on operation
  CASE p_operation
    WHEN 'embedding' THEN
      op_count := usage_record.embeddings_count;
      op_limit := usage_record.embeddings_limit;
    WHEN 'clustering' THEN
      op_count := usage_record.clusterings_count;
      op_limit := usage_record.clusterings_limit;
    WHEN 'search' THEN
      op_count := usage_record.searches_count;
      op_limit := usage_record.searches_limit;
    ELSE
      op_count := 0;
      op_limit := 100;
  END CASE;
  
  RETURN QUERY SELECT 
    (op_count < op_limit)::BOOLEAN as allowed,
    op_count::INTEGER as current_count,
    op_limit::INTEGER as daily_limit,
    GREATEST(0, op_limit - op_count)::INTEGER as remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's usage statistics
-- Requirements: 8.6
CREATE OR REPLACE FUNCTION get_user_ai_usage_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE(
  date DATE,
  embeddings_count INTEGER,
  clusterings_count INTEGER,
  searches_count INTEGER,
  total_tokens INTEGER,
  estimated_cost DECIMAL,
  embeddings_limit INTEGER,
  clusterings_limit INTEGER,
  searches_limit INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    aud.date,
    aud.embeddings_count,
    aud.clusterings_count,
    aud.searches_count,
    aud.total_tokens,
    aud.estimated_cost,
    aud.embeddings_limit,
    aud.clusterings_limit,
    aud.searches_limit
  FROM ai_usage_daily aud
  WHERE aud.user_id = p_user_id
    AND aud.date >= CURRENT_DATE - p_days
  ORDER BY aud.date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
