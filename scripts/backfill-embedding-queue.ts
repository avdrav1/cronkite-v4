/**
 * Backfill embedding queue with existing articles that don't have embeddings
 */

import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres:nfDhPjBAXX2AB37Wd-wE@db.rpqhkfkbpwzqcsdafogw.supabase.co:5432/postgres';

async function backfillEmbeddingQueue() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database\n');

    // Check if embedding_queue table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'embedding_queue'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️ embedding_queue table does not exist. Creating it...');
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS embedding_queue (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
          priority INTEGER DEFAULT 0,
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          last_attempt_at TIMESTAMPTZ,
          error_message TEXT,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(article_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
        CREATE INDEX IF NOT EXISTS idx_embedding_queue_priority ON embedding_queue(priority DESC);
      `);
      
      console.log('✅ Created embedding_queue table');
    }

    // Get articles without embeddings
    const articlesWithoutEmbeddings = await client.query(`
      SELECT id FROM articles 
      WHERE embedding IS NULL
      ORDER BY published_at DESC
    `);
    
    console.log(`📊 Found ${articlesWithoutEmbeddings.rows.length} articles without embeddings`);

    if (articlesWithoutEmbeddings.rows.length === 0) {
      console.log('✅ All articles already have embeddings!');
      return;
    }

    // Check current queue status
    const currentQueue = await client.query(`
      SELECT COUNT(*) as count FROM embedding_queue WHERE status = 'pending'
    `);
    console.log(`📊 Current pending items in queue: ${currentQueue.rows[0].count}`);

    // Add articles to embedding queue (in batches to avoid memory issues)
    const batchSize = 100;
    let added = 0;
    
    for (let i = 0; i < articlesWithoutEmbeddings.rows.length; i += batchSize) {
      const batch = articlesWithoutEmbeddings.rows.slice(i, i + batchSize);
      
      // Use INSERT ... ON CONFLICT to avoid duplicates
      const values = batch.map((row: any, idx: number) => 
        `($${idx + 1}::uuid, 0, 0, 3, 'pending')`
      ).join(', ');
      
      const params = batch.map((row: any) => row.id);
      
      await client.query(`
        INSERT INTO embedding_queue (article_id, priority, attempts, max_attempts, status)
        VALUES ${values}
        ON CONFLICT (article_id) DO NOTHING
      `, params);
      
      added += batch.length;
      console.log(`📥 Added ${added}/${articlesWithoutEmbeddings.rows.length} articles to queue...`);
    }

    // Verify queue status
    const finalQueue = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM embedding_queue 
      GROUP BY status
    `);
    
    console.log('\n📊 Final embedding queue status:');
    finalQueue.rows.forEach((row: any) => {
      console.log(`  - ${row.status}: ${row.count}`);
    });

    console.log('\n✅ Backfill complete! The ai-scheduler function will process these on its next run (every 5 minutes).');
    console.log('💡 You can also trigger it manually by visiting: https://cronkite-v4.netlify.app/.netlify/functions/ai-scheduler');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

backfillEmbeddingQueue();
