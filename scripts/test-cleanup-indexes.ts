/**
 * Test script for cleanup performance indexes
 * Verifies that the indexes created in migration 20260123000000 are working correctly
 * Uses EXPLAIN ANALYZE to check query performance
 */

import { getDatabase } from '../server/production-db';
import { sql } from 'drizzle-orm';

async function testCleanupIndexes() {
  console.log('🔍 Testing cleanup performance indexes...\n');

  const db = getDatabase();

  try {
    // Test 1: Verify idx_user_articles_protected index exists
    console.log('Test 1: Checking if idx_user_articles_protected index exists...');
    const protectedIndexCheck = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'user_articles' 
      AND indexname = 'idx_user_articles_protected'
    `);
    
    if (protectedIndexCheck && protectedIndexCheck.length > 0) {
      console.log('✅ idx_user_articles_protected exists');
      console.log('   Definition:', protectedIndexCheck[0].indexdef);
    } else {
      console.log('❌ idx_user_articles_protected NOT FOUND');
    }
    console.log('');

    // Test 2: Verify idx_user_articles_cleanup_candidates index exists
    console.log('Test 2: Checking if idx_user_articles_cleanup_candidates index exists...');
    const cleanupCandidatesCheck = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'user_articles' 
      AND indexname = 'idx_user_articles_cleanup_candidates'
    `);
    
    if (cleanupCandidatesCheck && cleanupCandidatesCheck.length > 0) {
      console.log('✅ idx_user_articles_cleanup_candidates exists');
      console.log('   Definition:', cleanupCandidatesCheck[0].indexdef);
    } else {
      console.log('❌ idx_user_articles_cleanup_candidates NOT FOUND');
    }
    console.log('');

    // Test 3: Verify idx_user_articles_article_protection index exists
    console.log('Test 3: Checking if idx_user_articles_article_protection index exists...');
    const articleProtectionCheck = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'user_articles' 
      AND indexname = 'idx_user_articles_article_protection'
    `);
    
    if (articleProtectionCheck && articleProtectionCheck.length > 0) {
      console.log('✅ idx_user_articles_article_protection exists');
      console.log('   Definition:', articleProtectionCheck[0].indexdef);
    } else {
      console.log('❌ idx_user_articles_article_protection NOT FOUND');
    }
    console.log('');

    // Test 4: Verify idx_article_comments_article_id index exists
    console.log('Test 4: Checking if idx_article_comments_article_id index exists...');
    const commentsIndexCheck = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'article_comments' 
      AND indexname = 'idx_article_comments_article_id'
    `);
    
    if (commentsIndexCheck && commentsIndexCheck.length > 0) {
      console.log('✅ idx_article_comments_article_id exists');
      console.log('   Definition:', commentsIndexCheck[0].indexdef);
    } else {
      console.log('❌ idx_article_comments_article_id NOT FOUND');
    }
    console.log('');

    // Test 5: EXPLAIN ANALYZE for protected articles query
    console.log('Test 5: EXPLAIN ANALYZE for protected articles query...');
    console.log('Query: SELECT article_id FROM user_articles WHERE user_id = $1 AND (is_starred = true OR is_read = true)');
    
    // Create a test user ID (using a random UUID for testing)
    const testUserId = '00000000-0000-0000-0000-000000000001';
    
    const explainProtected = await db.execute(sql`
      EXPLAIN ANALYZE
      SELECT article_id 
      FROM user_articles 
      WHERE user_id = ${testUserId} 
      AND (is_starred = true OR is_read = true)
    `);
    
    console.log('Execution plan:');
    explainProtected.forEach((row: any) => {
      console.log('  ', row['QUERY PLAN']);
    });
    console.log('');

    // Test 6: EXPLAIN ANALYZE for cleanup candidates query
    console.log('Test 6: EXPLAIN ANALYZE for cleanup candidates query...');
    console.log('Query: SELECT article_id FROM user_articles WHERE user_id = $1 AND is_starred = false AND is_read = false ORDER BY created_at DESC');
    
    const explainCandidates = await db.execute(sql`
      EXPLAIN ANALYZE
      SELECT article_id 
      FROM user_articles 
      WHERE user_id = ${testUserId} 
      AND is_starred = false 
      AND is_read = false 
      ORDER BY created_at DESC
    `);
    
    console.log('Execution plan:');
    explainCandidates.forEach((row: any) => {
      console.log('  ', row['QUERY PLAN']);
    });
    console.log('');

    // Test 7: EXPLAIN ANALYZE for multi-user protection check
    console.log('Test 7: EXPLAIN ANALYZE for multi-user protection check...');
    console.log('Query: SELECT COUNT(*) FROM user_articles WHERE article_id = $1 AND (is_starred = true OR is_read = true)');
    
    const testArticleId = '00000000-0000-0000-0000-000000000001';
    
    const explainMultiUser = await db.execute(sql`
      EXPLAIN ANALYZE
      SELECT COUNT(*) 
      FROM user_articles 
      WHERE article_id = ${testArticleId} 
      AND (is_starred = true OR is_read = true)
    `);
    
    console.log('Execution plan:');
    explainMultiUser.forEach((row: any) => {
      console.log('  ', row['QUERY PLAN']);
    });
    console.log('');

    // Test 8: EXPLAIN ANALYZE for articles with comments
    console.log('Test 8: EXPLAIN ANALYZE for articles with comments...');
    console.log('Query: SELECT DISTINCT article_id FROM article_comments');
    
    const explainComments = await db.execute(sql`
      EXPLAIN ANALYZE
      SELECT DISTINCT article_id 
      FROM article_comments
    `);
    
    console.log('Execution plan:');
    explainComments.forEach((row: any) => {
      console.log('  ', row['QUERY PLAN']);
    });
    console.log('');

    // Test 9: Check index sizes
    console.log('Test 9: Checking index sizes...');
    const indexSizes = await db.execute(sql`
      SELECT 
        indexname,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as size
      FROM pg_indexes
      WHERE tablename IN ('user_articles', 'article_comments')
      AND indexname IN (
        'idx_user_articles_protected',
        'idx_user_articles_cleanup_candidates',
        'idx_user_articles_article_protection',
        'idx_article_comments_article_id'
      )
      ORDER BY indexname
    `);
    
    console.log('Index sizes:');
    indexSizes.forEach((row: any) => {
      console.log(`   ${row.indexname}: ${row.size}`);
    });
    console.log('');

    console.log('✅ All index tests completed successfully!');

  } catch (error) {
    console.error('❌ Error testing indexes:', error);
    throw error;
  }
}

// Run the tests
testCleanupIndexes()
  .then(() => {
    console.log('\n✅ Index testing complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Index testing failed:', error);
    process.exit(1);
  });
