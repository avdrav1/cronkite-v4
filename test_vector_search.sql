-- Test vector search capabilities
-- This script tests the pgvector extension and semantic search functions

-- Test 1: Verify pgvector extension is enabled
SELECT 
    extname,
    extversion,
    extrelocatable
FROM pg_extension 
WHERE extname = 'vector';

-- Test 2: Check if articles table has embedding column with correct type
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'articles' 
AND column_name = 'embedding';

-- Test 3: Verify vector indexes exist
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'articles' 
AND indexname LIKE '%embedding%';

-- Test 4: Test cosine similarity function with sample vectors
SELECT cosine_similarity(
    '[0.1, 0.2, 0.3]'::vector(3),
    '[0.1, 0.2, 0.3]'::vector(3)
) as identical_vectors_similarity;

SELECT cosine_similarity(
    '[1, 0, 0]'::vector(3),
    '[0, 1, 0]'::vector(3)
) as orthogonal_vectors_similarity;

-- Test 5: Check embedding statistics function
SELECT * FROM get_embedding_stats();

-- Test 6: Verify articles_with_embeddings view exists and is accessible
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE viewname = 'articles_with_embeddings';

-- Test 7: Test that we can insert an article with an embedding
-- First, let's create a test user and feed (if they don't exist)
DO $$
DECLARE
    test_user_id UUID;
    test_feed_id UUID;
    test_article_id UUID;
    sample_embedding vector(1536);
BEGIN
    -- Create a sample 1536-dimensional embedding (all zeros for simplicity)
    sample_embedding := array_fill(0.0, ARRAY[1536])::vector(1536);
    
    -- Insert test user into auth.users (simulating Supabase auth)
    INSERT INTO auth.users (id, email, created_at, updated_at, email_confirmed_at)
    VALUES (gen_random_uuid(), 'test@example.com', NOW(), NOW(), NOW())
    ON CONFLICT (email) DO NOTHING
    RETURNING id INTO test_user_id;
    
    -- Get the user ID if it already exists
    IF test_user_id IS NULL THEN
        SELECT id INTO test_user_id FROM auth.users WHERE email = 'test@example.com';
    END IF;
    
    -- Insert test feed
    INSERT INTO feeds (id, user_id, name, url, status, priority)
    VALUES (gen_random_uuid(), test_user_id, 'Test Feed', 'https://example.com/feed.xml', 'active', 'medium')
    ON CONFLICT (user_id, url) DO NOTHING
    RETURNING id INTO test_feed_id;
    
    -- Get the feed ID if it already exists
    IF test_feed_id IS NULL THEN
        SELECT id INTO test_feed_id FROM feeds WHERE user_id = test_user_id AND url = 'https://example.com/feed.xml';
    END IF;
    
    -- Insert test article with embedding
    INSERT INTO articles (id, feed_id, guid, title, url, embedding, ai_summary, ai_summary_generated_at)
    VALUES (
        gen_random_uuid(),
        test_feed_id,
        'test-article-1',
        'Test Article with Embedding',
        'https://example.com/article1',
        sample_embedding,
        'This is a test AI summary',
        NOW()
    )
    ON CONFLICT (feed_id, guid) DO NOTHING
    RETURNING id INTO test_article_id;
    
    RAISE NOTICE 'Test data created: User ID %, Feed ID %, Article ID %', test_user_id, test_feed_id, test_article_id;
END $$;

-- Test 8: Verify we can query articles with embeddings
SELECT 
    COUNT(*) as articles_with_embeddings_count
FROM articles_with_embeddings;

-- Test 9: Test similarity search functions (should work even with minimal data)
SELECT 
    'find_similar_articles' as test_function,
    COUNT(*) as result_count
FROM find_similar_articles(
    array_fill(0.1, ARRAY[1536])::vector(1536),
    0.5,
    5
);

RAISE NOTICE 'Vector search capabilities test completed successfully!';