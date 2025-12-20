# Project Structure

## Root Level
```
├── client/          # React frontend application
├── server/          # Express.js backend
├── shared/          # Shared types and schemas
├── script/          # Build scripts
├── attached_assets/ # Static assets and images
└── .kiro/          # Kiro configuration and steering
```

## Client Structure (`/client`)
```
client/
├── src/
│   ├── components/     # React components organized by feature
│   │   ├── article/    # Article display components
│   │   ├── feed/       # Feed and article card components
│   │   ├── layout/     # Layout and shell components
│   │   ├── onboarding/ # User onboarding flow
│   │   ├── settings/   # Settings page components
│   │   ├── trending/   # Trending topics features
│   │   └── ui/         # shadcn/ui base components
│   ├── data/          # Static data (categories, regions, feeds)
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities and mock data
│   ├── pages/         # Top-level page components
│   ├── App.tsx        # Main app component with providers
│   ├── main.tsx       # React entry point
│   └── index.css      # Global styles and Tailwind imports
├── public/            # Static assets
└── index.html         # HTML template
```

## Server Structure (`/server`)
```
server/
├── index.ts          # Express server setup and startup
├── routes.ts         # API route definitions
├── static.ts         # Static file serving for production
├── storage.ts        # Database interface layer
└── vite.ts          # Vite integration for development
```

## Component Organization

### Feature-Based Structure
Components are organized by feature/domain rather than by type:
- `article/` - Article reading and display
- `feed/` - Main feed, article cards, filtering
- `onboarding/` - User setup and preferences
- `settings/` - Configuration and management
- `trending/` - Topic clustering and trending content

### UI Components
Base UI components from shadcn/ui are in `/components/ui/` and follow the library's conventions.

## File Naming Conventions
- **Components**: PascalCase (e.g., `ArticleCard.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `use-mobile.tsx`)
- **Utilities**: kebab-case (e.g., `mock-data.ts`)
- **Pages**: PascalCase (e.g., `Home.tsx`)

## Import Patterns
- Use path aliases: `@/components`, `@/lib`, `@shared`
- Relative imports for same-directory files
- Group imports: external libraries, internal modules, relative imports

## Data Flow
- Mock data in `/lib/mock-*.ts` files for development
- Shared types in `/shared/schema.ts`
- API routes prefixed with `/api`
- Client state managed with TanStack Query and local React state