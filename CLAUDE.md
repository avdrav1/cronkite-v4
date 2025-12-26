# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cronkite is an AI-powered RSS news aggregator with intelligent clustering, semantic search, and personalized content delivery. It uses Supabase for authentication and database, with OpenAI for embeddings and Anthropic for AI summaries.

## Common Commands

```bash
# Development
npm run dev              # Start dev server with Vite HMR (port 5000)
npm run check            # TypeScript type checking

# Testing
npm run test             # Run all tests once
npm run test:watch       # Run tests in watch mode
vitest path/to/test.ts   # Run a single test file

# Database (Supabase)
npm run supabase:start   # Start local Supabase
npm run supabase:stop    # Stop local Supabase
npm run db:push          # Push Drizzle schema to database
npm run db:seed          # Seed database with basic data
npm run db:reset:dev     # Reset and seed for development

# Build & Deploy
npm run build            # Build for production
npm run start            # Start production server
```

## Architecture

### Directory Structure
- `client/` - React frontend (Vite, TanStack Query, shadcn/ui, wouter for routing)
- `server/` - Express backend with API routes
- `shared/` - Shared code (Drizzle schema, Supabase types, category mappings)
- `supabase/migrations/` - SQL migrations for Supabase
- `test/` - Test files (Vitest)

### Key Server Files
- `server/routes.ts` - All API routes (~3000 lines, main API surface)
- `server/storage.ts` - Storage abstraction layer
- `server/supabase-storage.ts` - Supabase storage implementation
- `server/auth-middleware.ts` - Authentication with Supabase Auth
- `server/ai-summary.ts` - Anthropic AI summaries
- `server/embedding-service.ts` - OpenAI embeddings
- `server/clustering-service.ts` - Article clustering via vector similarity
- `server/rss-sync.ts` - RSS feed synchronization
- `server/feed-scheduler.ts` - Priority-based feed sync scheduling

### Key Client Files
- `client/src/App.tsx` - Main app with routing (wouter)
- `client/src/contexts/AuthContext.tsx` - Supabase auth context
- `client/src/pages/Home.tsx` - Main feed view
- `client/src/lib/queryClient.ts` - TanStack Query configuration

### Database Schema
Schema is defined in `shared/schema.ts` using Drizzle ORM. Main tables:
- `profiles` - User profiles extending Supabase auth
- `feeds` - User RSS feed subscriptions
- `articles` - Fetched articles with embeddings
- `clusters` - AI-generated article clusters
- `user_articles` - Read/starred state per user
- `recommended_feeds` - Curated feed suggestions
- `ai_usage_log` / `ai_usage_daily` - AI API usage tracking

### Path Aliases
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@server/*` → `server/*` (in tests)

## Environment Variables

Required variables (see `.env.example`):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `OPENAI_API_KEY` - For embeddings
- `ANTHROPIC_API_KEY` - For AI summaries
- `SESSION_SECRET` - Min 32 characters

## AI Features

The app has three AI-powered features with rate limiting:
1. **Embeddings** (OpenAI) - Generated for articles, stored in `articles.embedding`
2. **Clustering** - Groups similar articles by vector similarity
3. **Summaries** (Anthropic) - On-demand article summaries

Background scheduler runs in `server/ai-background-scheduler.ts`.

## Testing Patterns

Tests use Vitest with jsdom environment. Setup file: `test/setup.ts`

```bash
# Run specific test
vitest test/clustering-service.test.ts

# Run tests matching pattern
vitest --run -t "should cluster"
```

## Deployment

Production deployment targets Netlify with serverless functions. Build output goes to `dist/`. Configuration in `netlify.toml`.
