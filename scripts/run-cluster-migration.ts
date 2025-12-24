/**
 * Run cluster scoring columns migration on production Supabase
 * 
 * This script adds the missing columns to the clusters table that are needed
 * for vector-based clustering with relevance scores.
 * 
 * Usage: 
 *   For production: DATABASE_URL="postgresql://..." npx tsx scripts/run-cluster-migration.ts
 *   For local: npx tsx scripts/run-cluster-migration.ts
 */

import pg from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables (production first, then local as fallback)
dotenv.config({ path: '.env.production' });
dotenv.config({ path: '.env' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL');
  console.error('   Set it in .env.production or pass it directly:');
  console.error('   DATABASE_URL="postgresql://..." npx tsx scripts/run-cluster-migration.ts');
  process.exit(1);
}

// Check if this is a production URL
const isProduction = !DATABASE_URL.includes('127.0.0.1') && !DATABASE_URL.includes('localhost');
console.log(`🔗 Connecting to ${isProduction ? 'PRODUCTION' : 'LOCAL'} database...`);

if (isProduction) {
  console.log('⚠️  WARNING: This will modify the PRODUCTION database!');
  console.log('   Press Ctrl+C within 3 seconds to cancel...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  console.log('\n📊 Running cluster scoring columns migration...\n');

  const client = await pool.connect();
  
  try {
    const migrations = [
      {
        name: 'Add avg_similarity column',
        sql: `ALTER TABLE clusters ADD COLUMN IF NOT EXISTS avg_similarity TEXT;`
      },
      {
        name: 'Add relevance_score column',
        sql: `ALTER TABLE clusters ADD COLUMN IF NOT EXISTS relevance_score TEXT;`
      },
      {
        name: 'Add generation_method column',
        sql: `ALTER TABLE clusters ADD COLUMN IF NOT EXISTS generation_method TEXT DEFAULT 'vector';`
      },
      {
        name: 'Create relevance_score index',
        sql: `CREATE INDEX IF NOT EXISTS idx_clusters_relevance_score ON clusters(relevance_score DESC NULLS LAST);`
      },
      {
        name: 'Create expires_at index',
        sql: `CREATE INDEX IF NOT EXISTS idx_clusters_expires_at ON clusters(expires_at);`
      },
      {
        name: 'Create generation_method index',
        sql: `CREATE INDEX IF NOT EXISTS idx_clusters_generation_method ON clusters(generation_method);`
      }
    ];

    let successCount = 0;
    let failCount = 0;

    for (const migration of migrations) {
      try {
        console.log(`  ⏳ ${migration.name}...`);
        await client.query(migration.sql);
        console.log(`  ✅ ${migration.name}`);
        successCount++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        
        // Check if it's a "table doesn't exist" error
        if (errorMsg.includes('does not exist')) {
          console.log(`  ⚠️  ${migration.name}: clusters table doesn't exist yet (will be created on first cluster)`);
        } else {
          console.log(`  ❌ ${migration.name}: ${errorMsg}`);
        }
        failCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Succeeded: ${successCount}`);
    console.log(`   ❌ Failed/Skipped: ${failCount}`);

    // Verify the table structure
    console.log('\n🔍 Verifying clusters table structure...');
    
    try {
      const result = await client.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns 
        WHERE table_name = 'clusters' 
        AND column_name IN ('avg_similarity', 'relevance_score', 'generation_method')
        ORDER BY column_name;
      `);
      
      if (result.rows.length === 0) {
        console.log('   ⚠️  clusters table does not exist or columns not found');
        console.log('   The table will be created when the first cluster is generated');
      } else {
        console.log('   ✅ Found columns:');
        for (const row of result.rows) {
          console.log(`      - ${row.column_name}: ${row.data_type}${row.column_default ? ` (default: ${row.column_default})` : ''}`);
        }
      }
      
      // Check cluster count
      try {
        const countResult = await client.query('SELECT COUNT(*) as count FROM clusters;');
        console.log(`   📊 Current cluster count: ${countResult.rows[0].count}`);
      } catch {
        console.log('   📊 No clusters table yet');
      }
    } catch (err) {
      console.log(`   ❌ Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Ensure ANTHROPIC_API_KEY and OPENAI_API_KEY are set in Netlify environment variables');
    console.log('2. Trigger a new deploy on Netlify');
    console.log('3. The scheduled function will run every 5 minutes to generate clusters');
    
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
