-- Enhance vector search capabilities for semantic article search
-- Requirements: 15.1, 15.2, 15.4, 15.5

-- Verify pgvector extension is available and enabled
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension is not available. Please install pgvector extension first.';
    END IF;
END $$;

-- Create additional vector indexes for better performance
-- HNSW index for better query performance (if supported)
CREATE INDEX IF NOT EXISTS idx_articles_embedding_hnsw ON articles 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Create function for semantic similarity search
CREATE OR REPLACE FUNCTION find_similar_articles(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10,
    user_id_filter UUID DEFAULT NULL
)
RETURNS TABLE (
    article_id UUID,
    title TEXT,
    url TEXT,
    similarity_score FLOAT,
    feed_name TEXT,
    published_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as article_id,
        a.title,
        a.url,
        1 - (a.embedding <=> query_embedding) as similarity_score,
        f.name as feed_name,
        a.published_at
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE 
        a.embedding IS NOT NULL
        AND (user_id_filter IS NULL OR f.user_id = user_id_filter)
        AND (1 - (a.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for finding articles similar to a given article
CREATE OR REPLACE FUNCTION find_articles_similar_to(
    source_article_id UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10,
    user_id_filter UUID DEFAULT NULL
)
RETURNS TABLE (
    article_id UUID,
    title TEXT,
    url TEXT,
    similarity_score FLOAT,
    feed_name TEXT,
    published_at TIMESTAMPTZ
) AS $$
DECLARE
    source_embedding VECTOR(1536);
BEGIN
    -- Get the embedding of the source article
    SELECT embedding INTO source_embedding
    FROM articles
    WHERE id = source_article_id AND embedding IS NOT NULL;
    
    IF source_embedding IS NULL THEN
        RAISE EXCEPTION 'Source article not found or has no embedding';
    END IF;
    
    -- Find similar articles
    RETURN QUERY
    SELECT 
        a.id as article_id,
        a.title,
        a.url,
        1 - (a.embedding <=> source_embedding) as similarity_score,
        f.name as feed_name,
        a.published_at
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE 
        a.id != source_article_id  -- Exclude the source article itself
        AND a.embedding IS NOT NULL
        AND (user_id_filter IS NULL OR f.user_id = user_id_filter)
        AND (1 - (a.embedding <=> source_embedding)) >= similarity_threshold
    ORDER BY a.embedding <=> source_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for clustering articles by similarity
CREATE OR REPLACE FUNCTION cluster_similar_articles(
    similarity_threshold FLOAT DEFAULT 0.8,
    min_cluster_size INTEGER DEFAULT 3,
    max_articles_per_cluster INTEGER DEFAULT 20,
    time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    cluster_articles UUID[],
    representative_article_id UUID,
    avg_similarity FLOAT
) AS $$
DECLARE
    article_record RECORD;
    current_cluster UUID[];
    processed_articles UUID[] := '{}';
    similar_articles UUID[];
BEGIN
    -- Process articles from the last time window that have embeddings
    FOR article_record IN 
        SELECT id, embedding, title
        FROM articles 
        WHERE embedding IS NOT NULL 
        AND fetched_at >= NOW() - INTERVAL '1 hour' * time_window_hours
        AND NOT (id = ANY(processed_articles))
        ORDER BY fetched_at DESC
    LOOP
        -- Skip if already processed
        IF article_record.id = ANY(processed_articles) THEN
            CONTINUE;
        END IF;
        
        -- Find similar articles
        SELECT ARRAY_AGG(a.id) INTO similar_articles
        FROM articles a
        WHERE a.embedding IS NOT NULL
        AND a.id != article_record.id
        AND NOT (a.id = ANY(processed_articles))
        AND a.fetched_at >= NOW() - INTERVAL '1 hour' * time_window_hours
        AND (1 - (a.embedding <=> article_record.embedding)) >= similarity_threshold
        ORDER BY a.embedding <=> article_record.embedding
        LIMIT max_articles_per_cluster - 1;
        
        -- Create cluster if we have enough similar articles
        IF array_length(similar_articles, 1) >= min_cluster_size - 1 THEN
            current_cluster := ARRAY[article_record.id] || similar_articles;
            processed_articles := processed_articles || current_cluster;
            
            -- Calculate average similarity
            RETURN QUERY
            SELECT 
                current_cluster as cluster_articles,
                article_record.id as representative_article_id,
                (
                    SELECT AVG(1 - (a.embedding <=> article_record.embedding))
                    FROM articles a
                    WHERE a.id = ANY(similar_articles)
                )::FLOAT as avg_similarity;
        ELSE
            -- Mark as processed even if not clustered
            processed_articles := processed_articles || ARRAY[article_record.id];
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate cosine similarity between two embeddings
CREATE OR REPLACE FUNCTION cosine_similarity(
    embedding1 VECTOR(1536),
    embedding2 VECTOR(1536)
)
RETURNS FLOAT AS $$
BEGIN
    IF embedding1 IS NULL OR embedding2 IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- pgvector's <=> operator returns cosine distance (1 - cosine similarity)
    -- So we return 1 - distance to get similarity
    RETURN 1 - (embedding1 <=> embedding2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to get embedding statistics
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
    total_articles BIGINT,
    articles_with_embeddings BIGINT,
    embedding_coverage_percent NUMERIC,
    avg_embedding_age_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_articles,
        COUNT(embedding) as articles_with_embeddings,
        ROUND((COUNT(embedding)::NUMERIC / COUNT(*)) * 100, 2) as embedding_coverage_percent,
        ROUND(EXTRACT(EPOCH FROM AVG(NOW() - ai_summary_generated_at)) / 3600, 2) as avg_embedding_age_hours
    FROM articles
    WHERE fetched_at >= NOW() - INTERVAL '30 days';  -- Last 30 days
END;
$$ LANGUAGE plpgsql;

-- Create view for articles with similarity search capabilities
CREATE OR REPLACE VIEW articles_with_embeddings AS
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
    a.embedding IS NOT NULL as has_embedding,
    a.cluster_id,
    a.created_at,
    f.name as feed_name,
    f.user_id
FROM articles a
JOIN feeds f ON a.feed_id = f.id
WHERE a.embedding IS NOT NULL;

-- Grant necessary permissions for the functions
GRANT EXECUTE ON FUNCTION find_similar_articles TO authenticated;
GRANT EXECUTE ON FUNCTION find_articles_similar_to TO authenticated;
GRANT EXECUTE ON FUNCTION cosine_similarity TO authenticated;
GRANT EXECUTE ON FUNCTION get_embedding_stats TO authenticated;
GRANT SELECT ON articles_with_embeddings TO authenticated;

-- Note: RLS policies cannot be applied to views directly.
-- The underlying articles table already has RLS policies that will be enforced
-- when querying through the view.

-- Add comments for documentation
COMMENT ON FUNCTION find_similar_articles IS 'Find articles similar to a given embedding vector using cosine similarity';
COMMENT ON FUNCTION find_articles_similar_to IS 'Find articles similar to a specific article using its embedding';
COMMENT ON FUNCTION cluster_similar_articles IS 'Automatically cluster similar articles based on embedding similarity';
COMMENT ON FUNCTION cosine_similarity IS 'Calculate cosine similarity between two embedding vectors';
COMMENT ON FUNCTION get_embedding_stats IS 'Get statistics about embedding coverage and age';
COMMENT ON VIEW articles_with_embeddings IS 'View of articles that have vector embeddings for semantic search';

-- Create additional indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_articles_embedding_not_null ON articles(id) WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_ai_summary_embedding ON articles(ai_summary_generated_at, embedding) WHERE embedding IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_fetched_embedding ON articles(fetched_at DESC, embedding) WHERE embedding IS NOT NULL;