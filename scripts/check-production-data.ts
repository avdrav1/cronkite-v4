/**
 * Check production database for articles and clusters
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkData() {
  const client = await pool.connect();
  
  try {
    // Check article count
    const articles = await client.query('SELECT COUNT(*) as count FROM articles');
    console.log('📰 Total articles:', articles.rows[0].count);

    // Check articles with recent dates
    const recent = await client.query("SELECT COUNT(*) as count FROM articles WHERE published_at > NOW() - INTERVAL '7 days'");
    console.log('📰 Articles from last 7 days:', recent.rows[0].count);

    // Check feeds count
    const feeds = await client.query('SELECT COUNT(*) as count FROM feeds');
    console.log('📁 Total user feeds:', feeds.rows[0].count);

    // Check clusters
    const clusters = await client.query('SELECT COUNT(*) as count FROM clusters');
    console.log('🔗 Total clusters:', clusters.rows[0].count);

    // Check users
    const users = await client.query('SELECT COUNT(*) as count FROM profiles');
    console.log('👤 Total users:', users.rows[0].count);

    // Check recommended feeds
    const recommended = await client.query('SELECT COUNT(*) as count FROM recommended_feeds');
    console.log('⭐ Recommended feeds:', recommended.rows[0].count);

    // Sample some articles if they exist
    if (parseInt(articles.rows[0].count) > 0) {
      const sample = await client.query('SELECT title, feed_id, published_at FROM articles ORDER BY published_at DESC LIMIT 5');
      console.log('\n📰 Recent articles:');
      for (const row of sample.rows) {
        console.log(`   - ${row.title?.substring(0, 60)}... (${row.published_at})`);
      }
    }

    // Check if any user has feeds
    const userFeeds = await client.query(`
      SELECT p.email, COUNT(f.id) as feed_count 
      FROM profiles p 
      LEFT JOIN feeds f ON p.id = f.user_id 
      GROUP BY p.id, p.email 
      HAVING COUNT(f.id) > 0
      LIMIT 5
    `);
    
    if (userFeeds.rows.length > 0) {
      console.log('\n👤 Users with feeds:');
      for (const row of userFeeds.rows) {
        console.log(`   - ${row.email}: ${row.feed_count} feeds`);
      }
    } else {
      console.log('\n⚠️  No users have subscribed to any feeds yet');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

checkData().catch(console.error);
