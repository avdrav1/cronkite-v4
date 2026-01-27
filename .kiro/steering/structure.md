# Project Structure

## Root Level
```
├── client/          # React frontend application
├── server/          # Express.js backend
├── shared/          # Shared types and schemas
├── supabase/        # Supabase migrations and configuration
├── scripts/         # Database and maintenance scripts
├── script/          # Build scripts
├── test/            # Test files (Vitest)
├── netlify/         # Netlify Functions
├── docs/            # Documentation
├── attached_assets/ # Static assets and images
└── .kiro/          # Kiro configuration and steering
```

## Client Structure (`/client`)
```
client/
├── src/
│   ├── components/     # React components organized by feature
│   │   ├── article/    # Article display and similar articles
│   │   ├── auth/       # Login, register, Google OAuth
│   │   ├── comments/   # Comment system with tagging
│   │   ├── feed/       # Feed display, article cards, time filters
│   │   ├── friends/    # Friend management and discovery
│   │   ├── layout/     # Layout and shell components
│   │   ├── notifications/ # Notification display and preferences
│   │   ├── onboarding/ # User onboarding flow
│   │   ├── search/     # Semantic search
│   │   ├── settings/   # Settings pages (feeds, privacy, AI, etc.)
│   │   ├── trending/   # Trending topic clusters
│   │   └── ui/         # shadcn/ui base components (60+ components)
│   ├── contexts/      # React contexts (Auth, WebSocket)
│   ├── data/          # Static data (categories, regions, feeds)
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities, query client, session health
│   ├── pages/         # Top-level page components
│   │   ├── Home.tsx       # Main feed view
│   │   ├── Auth.tsx       # Login/register
│   │   ├── Settings.tsx   # Settings page
│   │   ├── Onboarding.tsx # Onboarding flow
│   │   └── Admin.tsx      # Admin panel
│   ├── App.tsx        # Main app with routing and providers
│   ├── main.tsx       # React entry point
│   └── index.css      # Global styles and Tailwind imports
├── public/            # Static assets (fonts, images)
└── index.html         # HTML template
```

## Server Structure (`/server`)
```
server/
├── index.ts                      # Express server setup and startup
├── routes.ts                     # API route definitions (~7000 lines)
├── app-setup.ts                  # Express middleware configuration
├── auth-middleware.ts            # Authentication and authorization
├── storage.ts                    # Database interface layer
├── supabase-storage.ts           # Supabase storage implementation
├── production-db.ts              # Database connection management
├── vite.ts                       # Vite integration for development
├── static.ts                     # Static file serving for production
├── netlify-handler.ts            # Netlify Functions wrapper
│
├── ai-summary.ts                 # Anthropic AI summaries
├── ai-rate-limiter.ts            # AI usage rate limiting
├── ai-background-scheduler.ts    # Background AI processing
├── embedding-service.ts          # OpenAI embeddings
├── clustering-service.ts         # Article clustering
├── semantic-search-service.ts    # Semantic search
├── similar-articles-service.ts   # Similar article recommendations
│
├── rss-sync.ts                   # RSS feed synchronization
├── production-rss-sync.ts        # Production RSS sync
├── feed-scheduler.ts             # Priority-based feed scheduling
├── feed-sync-integration.ts      # Feed sync integration service
├── feed-validation.ts            # Feed validation
├── feed-ownership.ts             # Feed ownership validation
├── feed-filtering-validation.ts  # Feed filtering logic
│
├── friend-service.ts             # Friend management (~950 lines)
├── comment-service.ts            # Comment system
├── notification-service.ts       # Notification system
├── privacy-service.ts            # Privacy controls
├── social-cache-service.ts       # Social query caching
├── social-query-optimizer.ts     # Query optimization
├── social-feed-service.ts        # Social feed generation
├── social-feed-preferences-service.ts # Social feed preferences
│
├── data-export-service.ts        # User data export
├── reporting-moderation-service.ts # Content reporting
├── websocket-service.ts          # Real-time WebSocket updates
├── security-utils.ts             # Security utilities
├── user-state-isolation.ts       # User state isolation
├── startup-validation.ts         # Startup checks
├── config.ts                     # Configuration management
└── env.ts                        # Environment variable loading
```

## Shared Structure (`/shared`)
```
shared/
├── schema.ts              # Drizzle ORM schema (~1500 lines)
├── supabase.ts           # Supabase client configuration
├── supabase-types.ts     # Generated Supabase types
└── category-mapping.ts   # Category mapping service
```

## Supabase Structure (`/supabase`)
```
supabase/
├── config.toml           # Supabase configuration
├── migrations/           # Database migrations (30+ files)
│   ├── 20240101000000_enable_pgvector.sql
│   ├── 20240102000000_create_user_management_tables.sql
│   ├── 20240127000000_create_social_friend_system.sql
│   └── ...
├── tests/               # SQL test files
└── seed.sql            # Seed data
```

## Scripts Structure (`/scripts`)
```
scripts/
├── seed-*.ts            # Database seeding scripts
├── check-*.ts           # Database status checks
├── validate-*.ts        # Validation scripts
├── fix-*.ts             # Database fix scripts
├── test-*.ts            # API testing scripts
└── README.md           # Scripts documentation
```

## Component Organization

### Feature-Based Structure
Components are organized by feature/domain:
- `article/` - Article display, sheets, similar articles
- `auth/` - Login, register, Google OAuth button
- `comments/` - Comment cards, forms, tagging, autocomplete
- `feed/` - Article cards, masonry grid, time filters, add feed modal
- `friends/` - Friend lists, requests, discovery, search, profiles
- `layout/` - App shell, navigation, sidebar
- `notifications/` - Notification list, cards, preferences
- `onboarding/` - Multi-step wizard, category/interest selection
- `search/` - Semantic search interface
- `settings/` - Feed management, privacy, AI usage, appearance
- `trending/` - Cluster display, drill-down, AI status
- `ui/` - 60+ shadcn/ui base components

### UI Components
Base UI components from shadcn/ui in `/components/ui/`:
- Forms: input, textarea, select, checkbox, radio, switch
- Layout: card, sheet, dialog, drawer, tabs, accordion
- Navigation: button, dropdown, command, menubar
- Feedback: alert, toast, progress, spinner, skeleton
- Data: table, pagination, calendar, chart
- And many more...

## File Naming Conventions
- **Components**: PascalCase (e.g., `ArticleCard.tsx`)
- **Services**: kebab-case (e.g., `friend-service.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `use-mobile.tsx`)
- **Utilities**: kebab-case (e.g., `query-client.ts`)
- **Pages**: PascalCase (e.g., `Home.tsx`)
- **Tests**: kebab-case with `.test.ts` suffix

## Import Patterns
- Use path aliases: `@/components`, `@/lib`, `@shared`, `@server` (tests)
- Relative imports for same-directory files
- Group imports: external libraries, internal modules, relative imports
- Service imports use singleton pattern (e.g., `import { friendService } from './friend-service'`)

## Data Flow
- **Client → Server**: TanStack Query for API calls
- **Server → Database**: Drizzle ORM with Supabase
- **Real-time**: WebSocket service for live updates
- **Background**: Schedulers for feed sync and AI processing
- **Caching**: Social cache service for performance
- **State**: React Context for auth and WebSocket, TanStack Query for server state

## API Routes Structure
All API routes are defined in `server/routes.ts`:
- `/api/health` - Health check
- `/api/auth/*` - Authentication (login, register, OAuth, logout)
- `/api/users/*` - User profile and settings
- `/api/feeds/*` - Feed management and sync
- `/api/articles/*` - Article operations (read, star, remove)
- `/api/clusters/*` - Trending topic clusters
- `/api/search/*` - Semantic search
- `/api/friends/*` - Friend management
- `/api/comments/*` - Comment system
- `/api/notifications/*` - Notification system
- `/api/privacy/*` - Privacy settings
- `/api/admin/*` - Admin operations

## Database Schema Overview
Main tables (see `shared/schema.ts` for details):
- `profiles` - User profiles
- `user_settings` - User preferences
- `feeds` - RSS feed subscriptions
- `articles` - Fetched articles with embeddings
- `user_articles` - Read/starred state
- `clusters` - AI-generated topic clusters
- `friendships` - Friend relationships
- `article_comments` - Comments on articles
- `notifications` - User notifications
- `user_privacy_settings` - Privacy controls
- `ai_usage_log` / `ai_usage_daily` - AI usage tracking
- `embedding_queue` - Embedding generation queue
- `feed_sync_log` - Feed sync history

## Testing Structure
Tests in `/test/` directory:
- Unit tests for services (friend, comment, notification, etc.)
- Integration tests for API routes
- Property-based tests for critical logic
- E2E tests for social system
- Test setup in `test/setup.ts`