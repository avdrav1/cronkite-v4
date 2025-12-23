/**
 * Check embeddings and clustering status in production database
 */

import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres:nfDhPjBAXX2AB37Wd-wE@db.rpqhkfkbpwzqcsdafogw.supabase.co:5432/postgres';

async function checkEmbeddingsStatus() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database\n');

    // Check total articles
    const totalArticles = await client.query('SELECT COUNT(*) as count FROM articles');
    console.log(`📊 Total articles: ${totalArticles.rows[0].count}`);

    // Check articles with embeddings
    const articlesWithEmbeddings = await client.query(
      'SELECT COUNT(*) as count FROM articles WHERE embedding IS NOT NULL'
    );
    console.log(`📊 Articles with embeddings: ${articlesWithEmbeddings.rows[0].count}`);

    // Check articles without embeddings
    const articlesWithoutEmbeddings = await client.query(
      'SELECT COUNT(*) as count FROM articles WHERE embedding IS NULL'
    );
    console.log(`📊 Articles without embeddings: ${articlesWithoutEmbeddings.rows[0].count}`);

    // Check recent articles (last 48 hours)
    const recentArticles = await client.query(`
      SELECT COUNT(*) as count FROM articles 
      WHERE published_at > NOW() - INTERVAL '48 hours'
    `);
    console.log(`📊 Recent articles (48h): ${recentArticles.rows[0].count}`);

    // Check recent articles with embeddings
    const recentWithEmbeddings = await client.query(`
      SELECT COUNT(*) as count FROM articles 
      WHERE published_at > NOW() - INTERVAL '48 hours'
      AND embedding IS NOT NULL
    `);
    console.log(`📊 Recent articles with embeddings: ${recentWithEmbeddings.rows[0].count}`);

    // Check clusters
    const clusters = await client.query('SELECT COUNT(*) as count FROM clusters');
    console.log(`\n📊 Total clusters: ${clusters.rows[0].count}`);

    // Check non-expired clusters
    const activeClusters = await client.query(`
      SELECT COUNT(*) as count FROM clusters 
      WHERE expires_at IS NULL OR expires_at > NOW()
    `);
    console.log(`📊 Active (non-expired) clusters: ${activeClusters.rows[0].count}`);

    // Check cluster details if any exist
    const clusterDetails = await client.query(`
      SELECT id, title, article_count, source_feeds, relevance_score, expires_at, created_at
      FROM clusters 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    if (clusterDetails.rows.length > 0) {
      console.log('\n📋 Recent clusters:');
      clusterDetails.rows.forEach((c: any) => {
        console.log(`  - "${c.title}" (${c.article_count} articles, score: ${c.relevance_score})`);
        console.log(`    Created: ${c.created_at}, Expires: ${c.expires_at}`);
      });
    }

    // Check user feeds
    const userFeeds = await client.query('SELECT COUNT(*) as count FROM user_feeds');
    console.log(`\n📊 User feeds: ${userFeeds.rows[0].count}`);

    // Check feeds table
    const feeds = await client.query('SELECT COUNT(*) as count FROM feeds');
    console.log(`📊 Total feeds: ${feeds.rows[0].count}`);

    // Check if embedding column exists and its type
    const embeddingColumn = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'articles' AND column_name = 'embedding'
    `);
    if (embeddingColumn.rows.length > 0) {
      console.log(`\n📊 Embedding column type: ${embeddingColumn.rows[0].data_type} (${embeddingColumn.rows[0].udt_name})`);
    } else {
      console.log('\n⚠️ Embedding column not found!');
    }

    // Sample an article with embedding to see the format
    const sampleEmbedding = await client.query(`
      SELECT id, title, 
             CASE WHEN embedding IS NOT NULL THEN 'has embedding' ELSE 'no embedding' END as embedding_status,
             pg_typeof(embedding) as embedding_type
      FROM articles 
      WHERE embedding IS NOT NULL
      LIMIT 1
    `);
    if (sampleEmbedding.rows.length > 0) {
      console.log(`\n📋 Sample article with embedding:`);
      console.log(`  ID: ${sampleEmbedding.rows[0].id}`);
      console.log(`  Title: ${sampleEmbedding.rows[0].title}`);
      console.log(`  Embedding type: ${sampleEmbedding.rows[0].embedding_type}`);
    }

    // Check AI usage tracking
    const aiUsage = await client.query(`
      SELECT operation_type, COUNT(*) as count, SUM(tokens_used) as total_tokens
      FROM ai_usage_log
      GROUP BY operation_type
      ORDER BY count DESC
    `);
    if (aiUsage.rows.length > 0) {
      console.log('\n📊 AI Usage by operation:');
      aiUsage.rows.forEach((row: any) => {
        console.log(`  - ${row.operation_type}: ${row.count} operations, ${row.total_tokens || 0} tokens`);
      });
    } else {
      console.log('\n📊 No AI usage logged yet');
    }

    // Check embedding queue
    const embeddingQueue = await client.query(`
      SELECT status, COUNT(*) as count
      FROM embedding_queue
      GROUP BY status
    `);
    if (embeddingQueue.rows.length > 0) {
      console.log('\n📊 Embedding queue status:');
      embeddingQueue.rows.forEach((row: any) => {
        console.log(`  - ${row.status}: ${row.count}`);
      });
    } else {
      console.log('\n📊 Embedding queue is empty');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkEmbeddingsStatus();
