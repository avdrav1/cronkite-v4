# Technology Stack

## Frontend
- **React 19** with TypeScript
- **Vite** for build tooling and development server
- **Tailwind CSS v4** for styling with CSS variables
- **shadcn/ui** component library (New York style)
- **Wouter** for client-side routing
- **TanStack Query** for server state management
- **Framer Motion** for animations
- **next-themes** for dark/light mode
- **Lucide React** for icons

## Backend
- **Node.js** with **Express.js**
- **TypeScript** throughout the stack
- **Drizzle ORM** with PostgreSQL
- **Zod** for schema validation
- **Express Session** with Passport.js for authentication

## Development Tools
- **tsx** for TypeScript execution
- **ESBuild** for fast compilation
- **Drizzle Kit** for database migrations
- **PostCSS** with Autoprefixer

## Common Commands

### Development
```bash
# Start development server (client only)
npm run dev:client

# Start full-stack development
npm run dev

# Type checking
npm run check
```

### Build & Deploy
```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Database
```bash
# Push schema changes to database
npm run db:push
```

## Path Aliases
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets/*` → `./attached_assets/*`

## Architecture Notes
- Monorepo structure with shared types in `/shared`
- Client-server separation with API routes prefixed `/api`
- Mock data used for development (see `/client/src/lib/mock-*.ts`)
- Component organization follows feature-based structure
- UI components use shadcn/ui with Tailwind CSS variables