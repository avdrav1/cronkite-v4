// Load environment variables from .env file
import { config } from "dotenv";

// Load environment-specific config
if (process.env.NODE_ENV === 'production') {
  config({ path: '.env.production' });
} else {
  config();
}

// Environment variable validation
interface RequiredEnvVars {
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SESSION_SECRET: string;
}

interface OptionalEnvVars {
  PORT: string;
  APP_URL: string;
  DATABASE_URL: string;  // Optional - only needed for direct PostgreSQL connections
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RSS_SYNC_INTERVAL: string;
  RSS_SYNC_BATCH_SIZE: string;
  RSS_SYNC_MAX_ARTICLES: string;
  MAX_ARTICLES_PER_USER_FEED: string;  // Maximum articles to keep per user (default: 250)
  NETLIFY_FUNCTION: string;
  NETLIFY: string;
  AWS_LAMBDA_FUNCTION_NAME: string;
  VERCEL: string;
  OPENAI_API_KEY: string;      // Required for embedding generation
  ANTHROPIC_API_KEY: string;   // Optional - for AI cluster labeling (has fallback)
}

// Validation functions
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidDatabaseUrl(url: string): boolean {
  return url.startsWith('postgresql://') && url.includes('@') && url.includes(':');
}

function isValidSupabaseUrl(url: string): boolean {
  return url.startsWith('https://') && url.includes('.supabase.co');
}

function isValidSessionSecret(secret: string): boolean {
  return secret.length >= 32; // Minimum 32 characters for security
}

// Environment validation
export function validateEnvironment(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  const requiredVars: (keyof RequiredEnvVars)[] = [
    'NODE_ENV',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SESSION_SECRET'
  ];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      errors.push(`Missing required environment variable: ${varName}`);
      continue;
    }

    // Validate specific formats
    switch (varName) {
      case 'SUPABASE_URL':
        if (process.env.NODE_ENV === 'production' && !isValidSupabaseUrl(value)) {
          errors.push(`Invalid SUPABASE_URL format for production. Expected: https://[project-ref].supabase.co`);
        } else if (process.env.NODE_ENV !== 'production' && !isValidUrl(value)) {
          errors.push(`Invalid SUPABASE_URL format. Expected valid URL`);
        }
        break;
      case 'SESSION_SECRET':
        if (!isValidSessionSecret(value)) {
          errors.push(`SESSION_SECRET must be at least 32 characters long for security`);
        }
        // Check for weak secrets
        if (value === 'your_session_secret_key' || 
            value === 'development' || 
            value === 'secret') {
          if (process.env.NODE_ENV === 'production') {
            errors.push('SESSION_SECRET is using a default/weak value in production');
          } else {
            warnings.push('SESSION_SECRET is using a default/weak value (acceptable in development)');
          }
        }
        break;
      case 'NODE_ENV':
        if (!['development', 'production', 'test'].includes(value)) {
          warnings.push(`NODE_ENV should be 'development', 'production', or 'test'. Current: ${value}`);
        }
        break;
    }
  }

  // Check optional but recommended variables for production
  if (process.env.NODE_ENV === 'production') {
    const productionRecommended = ['APP_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
    
    for (const varName of productionRecommended) {
      const value = process.env[varName];
      if (!value) {
        warnings.push(`Missing recommended production variable: ${varName}`);
      } else if (varName === 'APP_URL' && !isValidUrl(value)) {
        warnings.push(`Invalid APP_URL format. Expected: https://your-domain.com`);
      }
    }
    
    // Validate DATABASE_URL if provided (optional but validated if present)
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl && !isValidDatabaseUrl(databaseUrl)) {
      warnings.push(`Invalid DATABASE_URL format. Expected: postgresql://user:password@host:port/database`);
    }
    if (!databaseUrl) {
      console.log('ℹ️  DATABASE_URL not set - SupabaseStorage will use Supabase client API');
    }
  }

  // AI API key validation (Requirements: 1.1, 2.3, 9.5)
  // These are optional but recommended for full AI functionality
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  if (!openaiKey) {
    warnings.push('OPENAI_API_KEY not set - embedding generation and semantic search will be disabled');
  } else if (!openaiKey.startsWith('sk-')) {
    warnings.push('OPENAI_API_KEY appears to be invalid (should start with "sk-")');
  }
  
  if (!anthropicKey) {
    // This is informational, not a warning, since there's a fallback
    console.log('ℹ️  ANTHROPIC_API_KEY not set - cluster labeling will use fallback (first article title)');
  } else if (!anthropicKey.startsWith('sk-ant-')) {
    warnings.push('ANTHROPIC_API_KEY appears to be invalid (should start with "sk-ant-")');
  }

  // Validate numeric environment variables
  const numericVars = ['PORT', 'RSS_SYNC_INTERVAL', 'RSS_SYNC_BATCH_SIZE', 'RSS_SYNC_MAX_ARTICLES'];
  for (const varName of numericVars) {
    const value = process.env[varName];
    if (value && isNaN(Number(value))) {
      errors.push(`${varName} must be a valid number. Current: ${value}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Validate environment on module load
const validation = validateEnvironment();
if (!validation.valid) {
  console.error('❌ Environment validation failed:');
  validation.errors.forEach(error => console.error(`   • ${error}`));
  
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 Production deployment has invalid environment configuration');
    // Don't call process.exit(1) in serverless environments - it kills the function
    // Instead, we'll let the app start and fail gracefully on requests
    // The startup validation in app-setup.ts will handle this properly
    if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.VERCEL) {
      console.error('🚨 Exiting due to invalid environment configuration');
      process.exit(1);
    } else {
      console.error('⚠️  Running in serverless environment - will fail on requests instead of exiting');
    }
  }
}

if (validation.warnings.length > 0) {
  console.warn('⚠️  Environment validation warnings:');
  validation.warnings.forEach(warning => console.warn(`   • ${warning}`));
}

// Export environment variables for type safety
export const env: RequiredEnvVars & Partial<OptionalEnvVars> = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '5000',
  SESSION_SECRET: process.env.SESSION_SECRET || 'your_session_secret_key',
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  DATABASE_URL: process.env.DATABASE_URL,  // Optional
  APP_URL: process.env.APP_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  RSS_SYNC_INTERVAL: process.env.RSS_SYNC_INTERVAL || '3600000',
  RSS_SYNC_BATCH_SIZE: process.env.RSS_SYNC_BATCH_SIZE || '5',
  RSS_SYNC_MAX_ARTICLES: process.env.RSS_SYNC_MAX_ARTICLES || '100',
  NETLIFY_FUNCTION: process.env.NETLIFY_FUNCTION,
  NETLIFY: process.env.NETLIFY,
  AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
  VERCEL: process.env.VERCEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
};