-- Add article embedding tracking columns and queue table
-- Requirements: 1.4, 7.3

-- Add embedding status tracking columns to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (embedding_status IN ('pending', 'completed', 'failed', 'skipped'));
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding_error TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Create embedding_queue table for managing embedding generation
-- Requirements: 1.2, 7.1
CREATE TABLE IF NOT EXISTS embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id)
);

-- Create indexes for embedding status queries
CREATE INDEX IF NOT EXISTS idx_articles_embedding_status ON articles(embedding_status) 
  WHERE embedding_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_articles_embedding_generated ON articles(embedding_generated_at DESC) 
  WHERE embedding_status = 'completed';
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);

-- Create indexes for embedding queue queries
CREATE INDEX IF NOT EXISTS idx_embedding_queue_priority ON embedding_queue(priority DESC, created_at ASC) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
CREATE INDEX IF NOT EXISTS idx_embedding_queue_article ON embedding_queue(article_id);

-- Enable Row Level Security on embedding_queue
ALTER TABLE embedding_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for embedding_queue (service-level access)
-- Only service role can manage the queue
CREATE POLICY "Service can manage embedding queue" ON embedding_queue
  FOR ALL USING (true);

-- Create trigger to update updated_at on embedding_queue
CREATE TRIGGER update_embedding_queue_updated_at
  BEFORE UPDATE ON embedding_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to queue article for embedding generation
-- Requirements: 7.1
CREATE OR REPLACE FUNCTION queue_article_for_embedding(
  p_article_id UUID,
  p_priority INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  queue_id UUID;
BEGIN
  -- Insert into queue or update if already exists
  INSERT INTO embedding_queue (article_id, priority, status)
  VALUES (p_article_id, p_priority, 'pending')
  ON CONFLICT (article_id) 
  DO UPDATE SET 
    priority = GREATEST(embedding_queue.priority, EXCLUDED.priority),
    status = CASE 
      WHEN embedding_queue.status = 'dead_letter' THEN 'dead_letter'
      WHEN embedding_queue.status = 'completed' THEN 'completed'
      ELSE 'pending'
    END,
    updated_at = NOW()
  RETURNING id INTO queue_id;
  
  -- Update article embedding status to pending
  UPDATE articles 
  SET embedding_status = 'pending'
  WHERE id = p_article_id 
    AND embedding_status NOT IN ('completed', 'skipped');
  
  RETURN queue_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get next batch of articles for embedding
CREATE OR REPLACE FUNCTION get_embedding_queue_batch(
  p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE(
  queue_id UUID,
  article_id UUID,
  title TEXT,
  excerpt TEXT,
  content TEXT,
  priority INTEGER,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    eq.id as queue_id,
    eq.article_id,
    a.title,
    a.excerpt,
    a.content,
    eq.priority,
    eq.attempts
  FROM embedding_queue eq
  JOIN articles a ON a.id = eq.article_id
  WHERE eq.status = 'pending'
    AND (eq.last_attempt_at IS NULL OR eq.last_attempt_at < NOW() - INTERVAL '1 minute')
  ORDER BY eq.priority DESC, eq.created_at ASC
  LIMIT p_batch_size
  FOR UPDATE OF eq SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark embedding as completed
CREATE OR REPLACE FUNCTION complete_embedding(
  p_article_id UUID,
  p_content_hash TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Update article
  UPDATE articles 
  SET 
    embedding_status = 'completed',
    embedding_generated_at = NOW(),
    embedding_error = NULL,
    content_hash = p_content_hash
  WHERE id = p_article_id;
  
  -- Update queue
  UPDATE embedding_queue 
  SET 
    status = 'completed',
    updated_at = NOW()
  WHERE article_id = p_article_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark embedding as failed
CREATE OR REPLACE FUNCTION fail_embedding(
  p_article_id UUID,
  p_error_message TEXT
)
RETURNS VOID AS $$
DECLARE
  current_attempts INTEGER;
  max_attempts INTEGER;
BEGIN
  -- Get current attempts
  SELECT eq.attempts, eq.max_attempts 
  INTO current_attempts, max_attempts
  FROM embedding_queue eq
  WHERE eq.article_id = p_article_id;
  
  -- Increment attempts
  current_attempts := COALESCE(current_attempts, 0) + 1;
  
  -- Update queue
  UPDATE embedding_queue 
  SET 
    attempts = current_attempts,
    last_attempt_at = NOW(),
    error_message = p_error_message,
    status = CASE 
      WHEN current_attempts >= COALESCE(max_attempts, 3) THEN 'dead_letter'
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE article_id = p_article_id;
  
  -- Update article status
  UPDATE articles 
  SET 
    embedding_status = CASE 
      WHEN current_attempts >= COALESCE(max_attempts, 3) THEN 'failed'
      ELSE 'pending'
    END,
    embedding_error = p_error_message
  WHERE id = p_article_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate content hash for change detection
-- Requirements: 1.5
CREATE OR REPLACE FUNCTION generate_content_hash(
  p_title TEXT,
  p_excerpt TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN md5(COALESCE(p_title, '') || '|' || COALESCE(p_excerpt, ''));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
