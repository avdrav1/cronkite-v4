# Supabase Setup Guide for Cronkite

This document provides complete instructions for setting up and configuring Supabase for the Cronkite RSS aggregation platform.

## ✅ Completed Setup

The following components have been configured:

1. **Supabase CLI** - Installed and initialized
2. **Local Development Environment** - Running on localhost
3. **pgvector Extension** - Enabled for semantic search (v0.8.0)
4. **Environment Configuration** - `.env` and `.env.example` files created
5. **Database Migrations** - Initial migration for pgvector created
6. **Supabase Client** - TypeScript client configured in `shared/supabase.ts`

## 🚀 Quick Start

### Start Local Supabase
```bash
npm run supabase:start
```

### Check Status
```bash
npm run supabase:status
```

### Stop Supabase
```bash
npm run supabase:stop
```

## 📋 Available Services

When running locally, the following services are available:

| Service | URL | Description |
|---------|-----|-------------|
| **Studio** | http://127.0.0.1:54323 | Database management UI |
| **API** | http://127.0.0.1:54321 | REST and GraphQL APIs |
| **Database** | postgresql://postgres:postgres@127.0.0.1:54322/postgres | PostgreSQL connection |
| **Mailpit** | http://127.0.0.1:54324 | Email testing interface |

## 🔑 Authentication Keys (Local Development)

The following keys are configured for local development:

- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`

⚠️ **Never commit production keys to version control!**

## 🗄️ Database Configuration

### Enabled Extensions

- **pgvector** (v0.8.0) - For semantic search and AI embeddings
- **uuid-ossp** - For UUID generation (enabled by default)

### Connection Details

- **Host**: localhost
- **Port**: 54322
- **Database**: postgres
- **User**: postgres
- **Password**: postgres (local only)

## 📁 Project Structure

```
supabase/
├── config.toml              # Supabase configuration
├── migrations/              # Database schema migrations
│   └── 20240101000000_enable_pgvector.sql
├── seed.sql                 # Initial seed data
└── README.md               # Supabase-specific documentation
```

## 🔄 Database Migrations

### Apply Migrations
```bash
npm run supabase:migrate
```

### Reset Database (Development Only)
```bash
npm run supabase:reset
```

This will:
1. Drop all database objects
2. Re-run all migrations
3. Execute seed data

## 🛠️ Development Workflow

### 1. Start Supabase
```bash
npm run supabase:start
```

### 2. Develop Your Application
```bash
npm run dev
```

### 3. Access Studio
Open http://127.0.0.1:54323 to:
- View and edit data
- Run SQL queries
- Manage authentication
- Configure storage

### 4. Stop When Done
```bash
npm run supabase:stop
```

## 🌐 Production Deployment

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Create a new project
3. Note your project URL and keys

### 2. Update Environment Variables
Update `.env` with production values:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### 3. Run Migrations
```bash
# Link to your project
npx supabase link --project-ref your-project-ref

# Push migrations
npx supabase db push
```

## 🔐 Security Considerations

### Row Level Security (RLS)
- RLS will be configured in subsequent tasks
- Ensures users can only access their own data
- Public access limited to recommended feeds

### Environment Variables
- Never commit `.env` to version control
- Use `.env.example` as a template
- Rotate keys regularly in production

## 🧪 Testing Database Connection

Test the connection with:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT version();"
```

Verify pgvector:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)

## ✅ Verification Checklist

- [x] Supabase CLI installed
- [x] Local Supabase running
- [x] pgvector extension enabled
- [x] Environment variables configured
- [x] Database connection verified
- [x] Supabase client configured
- [ ] Schema migrations (next task)
- [ ] RLS policies (future task)

## 🆘 Troubleshooting

### Supabase won't start
```bash
# Stop all containers
npm run supabase:stop

# Remove volumes and restart
npx supabase stop --no-backup
npm run supabase:start
```

### Port conflicts
Edit `supabase/config.toml` to change default ports if needed.

### Database connection issues
Verify the DATABASE_URL in `.env` matches the output from `npm run supabase:status`.
