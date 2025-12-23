-- Create dead letter queue and request queue tables for AI rate limiting
-- Requirements: 8.4, 9.4

-- Create dead_letter_queue table for permanently failed operations
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL CHECK (operation IN ('embedding', 'clustering', 'search', 'summary')),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create request_queue table for rate-limited requests
CREATE TABLE IF NOT EXISTS request_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('embedding', 'clustering', 'search', 'summary')),
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  payload JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  scheduled_for TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_operation ON dead_letter_queue(operation);
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_created ON dead_letter_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_user ON dead_letter_queue(user_id);

CREATE INDEX IF NOT EXISTS idx_request_queue_user ON request_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_request_queue_scheduled ON request_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_request_queue_operation ON request_queue(operation);
CREATE INDEX IF NOT EXISTS idx_request_queue_priority ON request_queue(priority DESC, scheduled_for ASC);

-- Enable Row Level Security
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for dead_letter_queue
CREATE POLICY "Service can manage dead letter queue" ON dead_letter_queue
  FOR ALL USING (true);

-- Create RLS policies for request_queue
CREATE POLICY "Users can view own queued requests" ON request_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can manage request queue" ON request_queue
  FOR ALL USING (true);

-- Create function to add item to dead letter queue
CREATE OR REPLACE FUNCTION add_to_dead_letter_queue(
  p_operation TEXT,
  p_provider TEXT,
  p_user_id UUID,
  p_payload JSONB,
  p_error_message TEXT,
  p_attempts INTEGER
)
RETURNS UUID AS $$
DECLARE
  item_id UUID;
BEGIN
  INSERT INTO dead_letter_queue (
    operation, provider, user_id, payload, error_message, attempts, last_attempt_at
  ) VALUES (
    p_operation, p_provider, p_user_id, p_payload, p_error_message, p_attempts, NOW()
  ) RETURNING id INTO item_id;
  
  RETURN item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to add request to queue
CREATE OR REPLACE FUNCTION add_to_request_queue(
  p_user_id UUID,
  p_operation TEXT,
  p_provider TEXT,
  p_payload JSONB,
  p_priority INTEGER DEFAULT 0,
  p_scheduled_for TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  request_id UUID;
  schedule_time TIMESTAMPTZ;
BEGIN
  -- Default to next day at midnight UTC if not specified
  IF p_scheduled_for IS NULL THEN
    schedule_time := DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 day';
  ELSE
    schedule_time := p_scheduled_for;
  END IF;
  
  INSERT INTO request_queue (
    user_id, operation, provider, payload, priority, scheduled_for
  ) VALUES (
    p_user_id, p_operation, p_provider, p_payload, p_priority, schedule_time
  ) RETURNING id INTO request_id;
  
  RETURN request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get requests due for processing
CREATE OR REPLACE FUNCTION get_requests_due_for_processing(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  operation TEXT,
  provider TEXT,
  payload JSONB,
  priority INTEGER,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rq.id,
    rq.user_id,
    rq.operation,
    rq.provider,
    rq.payload,
    rq.priority,
    rq.scheduled_for,
    rq.created_at
  FROM request_queue rq
  WHERE rq.scheduled_for <= NOW()
  ORDER BY rq.priority DESC, rq.scheduled_for ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

