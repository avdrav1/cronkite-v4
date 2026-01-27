# Technology Stack

## Frontend
- **React 19** with TypeScript
- **Vite 7** for build tooling and development server
- **Tailwind CSS v4** for styling with CSS variables
- **shadcn/ui** component library (New York style)
- **Wouter** for client-side routing
- **TanStack Query v5** for server state management
- **Framer Motion** for animations
- **next-themes** for dark/light mode
- **Lucide React** for icons
- **React Hook Form** with Zod validation

## Backend
- **Node.js 20** with **Express.js**
- **TypeScript 5.6** throughout the stack
- **Drizzle ORM** with PostgreSQL (Supabase)
- **Supabase** for authentication, database, and storage
- **Zod** for schema validation
- **Passport.js** for session management
- **WebSocket (ws)** for real-time updates

## AI & ML
- **OpenAI API** for embeddings (text-embedding-3-small)
- **Anthropic Claude** for article summaries and clustering
- **pgvector** for vector similarity search
- **RSS Parser** for feed synchronization

## Database
- **PostgreSQL** via Supabase
- **pgvector extension** for semantic search
- **Drizzle ORM** for type-safe queries
- **Supabase Auth** for user management

## Deployment
- **Netlify** for hosting and serverless functions
- **Netlify Functions** for API routes
- **Scheduled Functions** for background jobs (feed sync, AI processing)
- **Environment Variables** for configuration

## Development Tools
- **tsx** for TypeScript execution
- **ESBuild** for fast compilation
- **Vitest** for testing with jsdom
- **Drizzle Kit** for database migrations
- **Supabase CLI** for local development
- **PostCSS** with Autoprefixer

## Common Commands

### Development
```bash
# Start development server (full-stack with Vite HMR)
npm run dev

# Start client only (Vite dev server)
npm run dev:client

# Type checking
npm run check

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

### Build & Deploy
```bash
# Build for production (Netlify)
npm run build

# Start production server (local)
npm run start

# Deploy to Netlify preview
npm run netlify:deploy:preview

# Deploy to Netlify production
npm run netlify:deploy:prod
```

### Database (Supabase)
```bash
# Start local Supabase
npm run supabase:start

# Stop local Supabase
npm run supabase:stop

# Check Supabase status
npm run supabase:status

# Push schema changes
npm run db:push

# Seed database with basic data
npm run db:seed

# Seed with comprehensive feeds
npm run db:seed:comprehensive

# Reset and seed for development
npm run db:reset:dev

# Check database status
npm run db:status
```

### Category Management
```bash
# Validate category mappings
npm run validate:categories

# Check category distribution
npm run category:distribution

# View category mapping status
npm run category:mapping:status
```

## Path Aliases
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets/*` → `./attached_assets/*`
- `@server/*` → `./server/*` (in tests)

## Architecture Notes
- **Monorepo structure** with shared types in `/shared`
- **Client-server separation** with API routes prefixed `/api`
- **Serverless-ready** with Netlify Functions support
- **Real-time updates** via WebSocket service
- **Background processing** with AI scheduler and feed sync scheduler
- **Modular services** for friends, comments, notifications, privacy, etc.
- **Component organization** follows feature-based structure
- **UI components** use shadcn/ui with Tailwind CSS variables
- **Type safety** with Drizzle ORM and Zod schemas
- **Session management** with Express Session and Passport.js
- **AI rate limiting** with daily usage tracking and queue management

## Environment Variables

Required for development (see `.env.example`):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for embeddings
- `ANTHROPIC_API_KEY` - Anthropic API key for summaries
- `SESSION_SECRET` - Session encryption secret (min 32 chars)
- `APP_URL` - Application base URL (for OAuth callbacks)

## Performance Optimizations
- **Caching layer** for social queries (friends, comments)
- **Pagination** for large datasets
- **Query optimization** with indexes and materialized views
- **Background jobs** for expensive operations (embeddings, clustering)
- **Rate limiting** for AI API calls
- **WebSocket** for real-time updates without polling