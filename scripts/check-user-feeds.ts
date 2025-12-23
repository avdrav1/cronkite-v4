/**
 * Check user feeds in production database
 */

import 'dotenv/config';
import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres:nfDhPjBAXX2AB37Wd-wE@db.rpqhkfkbpwzqcsdafogw.supabase.co:5432/postgres';

async function checkUserFeeds() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database\n');

    // Check profiles table
    const profiles = await client.query('SELECT id, email, display_name, onboarding_completed FROM profiles');
    console.log('📊 Users:');
    profiles.rows.forEach((p: any) => {
      console.log(`  - ${p.email} (${p.display_name}) - onboarding: ${p.onboarding_completed}`);
      console.log(`    ID: ${p.id}`);
    });

    // Check feeds table
    const feeds = await client.query(`
      SELECT f.id, f.name, f.user_id, p.email as user_email, 
             (SELECT COUNT(*) FROM articles WHERE feed_id = f.id) as article_count
      FROM feeds f
      LEFT JOIN profiles p ON f.user_id = p.id
      ORDER BY f.created_at DESC
      LIMIT 30
    `);
    
    console.log(`\n📊 Feeds (${feeds.rows.length} shown):`);
    feeds.rows.forEach((f: any) => {
      console.log(`  - ${f.name} (${f.article_count} articles)`);
      console.log(`    User: ${f.user_email || 'No user'}`);
    });

    // Check feeds per user
    const feedsPerUser = await client.query(`
      SELECT p.email, COUNT(f.id) as feed_count
      FROM profiles p
      LEFT JOIN feeds f ON f.user_id = p.id
      GROUP BY p.id, p.email
    `);
    
    console.log('\n📊 Feeds per user:');
    feedsPerUser.rows.forEach((row: any) => {
      console.log(`  - ${row.email}: ${row.feed_count} feeds`);
    });

    // Check articles per user's feeds
    const articlesPerUser = await client.query(`
      SELECT p.email, COUNT(a.id) as article_count
      FROM profiles p
      LEFT JOIN feeds f ON f.user_id = p.id
      LEFT JOIN articles a ON a.feed_id = f.id
      GROUP BY p.id, p.email
    `);
    
    console.log('\n📊 Articles per user:');
    articlesPerUser.rows.forEach((row: any) => {
      console.log(`  - ${row.email}: ${row.article_count} articles`);
    });

    // Check recent articles for the user
    const userArticles = await client.query(`
      SELECT a.id, a.title, f.name as feed_name, a.published_at
      FROM articles a
      JOIN feeds f ON a.feed_id = f.id
      JOIN profiles p ON f.user_id = p.id
      WHERE p.email = 'av@lab828.com'
      ORDER BY a.published_at DESC
      LIMIT 10
    `);
    
    console.log('\n📊 Recent articles for av@lab828.com:');
    userArticles.rows.forEach((a: any) => {
      console.log(`  - "${a.title}" (${a.feed_name})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkUserFeeds();
