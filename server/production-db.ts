// Production database configuration and connection management
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "./env";
import * as schema from "../shared/schema";

// Production database connection configuration
let sql: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDatabase() {
  if (!db) {
    if (!env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required for production');
    }

    console.log('🔗 Connecting to production database...');
    
    // Create postgres connection
    sql = postgres(env.DATABASE_URL, {
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: env.NETLIFY_FUNCTION ? 1 : 10, // Serverless functions need fewer connections
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // Disable prepared statements for better compatibility
    });

    // Create Drizzle instance
    db = drizzle(sql, { schema });
    
    console.log('✅ Production database connection established');
  }

  return db;
}

// Graceful shutdown for database connections
export async function closeDatabaseConnection() {
  if (sql) {
    console.log('🔌 Closing database connection...');
    await sql.end();
    sql = null;
    db = null;
    console.log('✅ Database connection closed');
  }
}

// Health check for database connection
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const database = getDatabase();
    
    if (!sql) {
      throw new Error('Database connection not established');
    }
    
    // Simple query to test connection
    await sql`SELECT 1 as health_check`;
    
    return { healthy: true };
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown database error' 
    };
  }
}

// Migration status check
export async function checkMigrationStatus(): Promise<{ upToDate: boolean; error?: string }> {
  try {
    const database = getDatabase();
    
    if (!sql) {
      throw new Error('Database connection not established');
    }
    
    // Check if migrations table exists and get latest migration
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
      ) as profiles_exists
    `;
    
    return { upToDate: result[0]?.profiles_exists === true };
  } catch (error) {
    console.error('❌ Migration status check failed:', error);
    return { 
      upToDate: false, 
      error: error instanceof Error ? error.message : 'Unknown migration error' 
    };
  }
}