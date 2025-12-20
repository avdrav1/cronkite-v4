# Supabase Configuration for Cronkite

This directory contains the Supabase configuration and database setup for the Cronkite RSS aggregation platform.

## Setup Instructions

### 1. Local Development

Start the local Supabase stack:
```bash
npm run supabase:start
```

This will start:
- PostgreSQL database on port 54322
- Supabase API on port 54321
- Supabase Studio on port 54323
- Email testing (Inbucket) on port 54324

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (keep secret)
- `DATABASE_URL`: PostgreSQL connection string

### 3. Database Migrations

Apply migrations:
```bash
npm run supabase:migrate
```

Reset database (development only):
```bash
npm run supabase:reset
```

### 4. Extensions Enabled

- **pgvector**: For semantic search and AI embeddings
- **uuid-ossp**: For UUID generation (default in Supabase)

### 5. Production Setup

For production deployment:
1. Create a Supabase project at https://supabase.com
2. Update environment variables with production values
3. Run migrations against production database
4. Configure Row Level Security policies

## Directory Structure

- `config.toml`: Supabase local development configuration
- `migrations/`: Database schema migrations
- `seed.sql`: Initial seed data
- `.temp/`: Temporary files (ignored by git)

## Useful Commands

```bash
# Check Supabase status
npm run supabase:status

# Stop local Supabase
npm run supabase:stop

# View logs
supabase logs

# Generate types
supabase gen types typescript --local > shared/database.types.ts
```