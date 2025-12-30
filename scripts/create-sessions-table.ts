// Script to create the user_sessions table for Express session storage
import postgres from 'postgres';
import dotenv from 'dotenv';

// Load production environment
dotenv.config({ path: '.env.production' });

// Use direct connection string with URL-encoded password (! = %21)
const DATABASE_URL = 'postgresql://postgres.rpqhkfkbpwzqcsdafogw:Cronkite2024%21@aws-0-us-west-1.pooler.supabase.com:6543/postgres';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

async function createSessionsTable() {
  console.log('🔧 Connecting to database...');
  
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
    idle_timeout: 10,
    connect_timeout: 30
  });

  try {
    console.log('📋 Creating user_sessions table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" VARCHAR NOT NULL COLLATE "default",
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL,
        CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
      )
    `;
    
    console.log('📋 Creating index on expire column...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire")
    `;
    
    console.log('✅ user_sessions table created successfully!');
    
    // Verify the table exists
    const result = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'user_sessions'
    `;
    
    if (result.length > 0) {
      console.log('✅ Verified: user_sessions table exists');
    } else {
      console.log('⚠️  Warning: Could not verify table creation');
    }
    
  } catch (error) {
    console.error('❌ Error creating sessions table:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('🔌 Database connection closed');
  }
}

createSessionsTable()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
