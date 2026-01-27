# Agent Development Guidelines for Cronkite

This document defines coding standards, architectural patterns, and testing requirements for AI agents working on the Cronkite codebase.

## Table of Contents
- [TypeScript Standards](#typescript-standards)
- [Express.js Backend Architecture](#expressjs-backend-architecture)
- [React Frontend Patterns](#react-frontend-patterns)
- [Database & ORM Guidelines](#database--orm-guidelines)
- [Testing Requirements](#testing-requirements)
- [Service Layer Patterns](#service-layer-patterns)
- [API Design Standards](#api-design-standards)
- [Security Best Practices](#security-best-practices)

---

## TypeScript Standards

### General Rules
- **Strict Mode**: Always use TypeScript strict mode (`"strict": true` in tsconfig.json)
- **No `any`**: Avoid `any` type; use `unknown` or proper types
- **Explicit Return Types**: Always declare return types for functions
- **Type Imports**: Use `import type` for type-only imports

### Type Definitions
```typescript
// ✅ Good: Explicit types with proper structure
interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}

async function getUserProfile(userId: string): Promise<UserProfile> {
  // Implementation
}

// ❌ Bad: Implicit any, no return type
function getUserProfile(userId) {
  // Implementation
}
```

### Zod Validation
- Use Zod for runtime validation of API inputs
- Define schemas alongside route handlers
- Leverage Drizzle-Zod integration for database schemas

```typescript
import { z } from "zod";

const updateProfileSchema = z.object({
  display_name: z.string().min(1).optional(),
  avatar_url: z.string().url().nullable().optional(),
  timezone: z.string().optional()
});

type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
```

### Error Handling
```typescript
// ✅ Good: Typed error handling
try {
  const result = await someOperation();
  return result;
} catch (error) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.errors
    });
  }
  
  console.error('Operation failed:', error);
  return res.status(500).json({
    error: 'Operation failed',
    message: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

---

## Express.js Backend Architecture

### Route Organization
- All routes defined in `server/routes.ts`
- Use middleware for authentication, validation, and error handling
- Group related routes with comments

```typescript
// Authentication Routes
app.post('/api/auth/register', requireNoAuth, async (req, res) => {
  // Implementation
});

app.post('/api/auth/login', requireNoAuth, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    // Implementation
  })(req, res, next);
});

// User Management Routes
app.get('/api/users/profile', requireAuth, async (req, res) => {
  // Implementation
});
```

### Middleware Patterns
```typescript
// Authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }
  next();
}

// Admin authorization
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.is_admin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
  next();
}
```

### Response Patterns
```typescript
// ✅ Good: Consistent response structure
res.json({
  user: {
    id: user.id,
    email: user.email,
    display_name: user.display_name
  }
});

// ✅ Good: Error responses
res.status(400).json({
  error: 'Validation error',
  message: 'Invalid input data',
  details: validationErrors
});

// ❌ Bad: Inconsistent structure
res.json(user); // Exposes internal structure
```

---

## React Frontend Patterns

### Component Structure
```typescript
// ✅ Good: Typed props, clear structure
interface ArticleCardProps {
  article: Article;
  onRead: (articleId: string) => void;
  onStar: (articleId: string) => void;
}

export function ArticleCard({ article, onRead, onStar }: ArticleCardProps) {
  return (
    <Card>
      {/* Implementation */}
    </Card>
  );
}
```

### Hooks Usage
```typescript
// Custom hooks for reusable logic
export function useArticleActions(articleId: string) {
  const queryClient = useQueryClient();
  
  const markAsRead = useMutation({
    mutationFn: async () => {
      await fetch(`/api/articles/${articleId}/read`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    }
  });
  
  return { markAsRead };
}
```

### TanStack Query Patterns
```typescript
// ✅ Good: Typed queries with proper keys
export function useArticles(filters: ArticleFilters) {
  return useQuery({
    queryKey: ['articles', filters],
    queryFn: async () => {
      const response = await fetch('/api/articles?' + new URLSearchParams(filters));
      if (!response.ok) throw new Error('Failed to fetch articles');
      return response.json() as Promise<Article[]>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### Context Usage
```typescript
// ✅ Good: Typed context with proper provider
interface AuthContextType {
  user: Profile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

## Database & ORM Guidelines

### Drizzle ORM Patterns
```typescript
// ✅ Good: Type-safe queries with proper joins
const userFriends = await db
  .select({
    friendship: friendships,
    profile: profiles
  })
  .from(friendships)
  .innerJoin(profiles, eq(profiles.id, friendships.user2_id))
  .where(
    and(
      eq(friendships.user1_id, userId),
      eq(friendships.status, 'confirmed')
    )
  );
```

### Schema Definitions
```typescript
// ✅ Good: Complete schema with proper types
export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  feed_id: uuid("feed_id").notNull().references(() => feeds.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  content: text("content"),
  embedding: text("embedding"), // Vector stored as text
  published_at: timestamp("published_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Export types
export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;
```

### Migrations
- Store migrations in `supabase/migrations/`
- Use timestamp-based naming: `YYYYMMDDHHMMSS_description.sql`
- Always include rollback logic in comments
- Test migrations on local Supabase before production

```sql
-- Migration: 20240127000000_create_social_friend_system.sql
-- Description: Add friend system tables

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rollback:
-- DROP TABLE friendships;
```

---

## Testing Requirements

### Vitest Configuration
- Use `vitest.config.ts` for test configuration
- Set up jsdom environment for React component tests
- Configure path aliases to match main config

### Unit Test Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { friendService } from '../server/friend-service';

describe('FriendService', () => {
  beforeEach(() => {
    // Reset mocks and state
    vi.clearAllMocks();
  });

  describe('sendFriendRequest', () => {
    it('should create a friend request between two users', async () => {
      // Arrange
      const fromUserId = 'user-1';
      const toUserId = 'user-2';
      
      // Act
      const request = await friendService.sendFriendRequest(fromUserId, toUserId);
      
      // Assert
      expect(request).toBeDefined();
      expect(request.status).toBe('pending');
      expect(request.fromUser.id).toBe(fromUserId);
    });

    it('should throw error if users are already friends', async () => {
      // Arrange
      const fromUserId = 'user-1';
      const toUserId = 'user-2';
      await friendService.sendFriendRequest(fromUserId, toUserId);
      await friendService.acceptFriendRequest(requestId, toUserId);
      
      // Act & Assert
      await expect(
        friendService.sendFriendRequest(fromUserId, toUserId)
      ).rejects.toThrow('Users are already friends');
    });
  });
});
```

### Integration Tests
```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';

describe('Friend API Integration', () => {
  it('should send friend request via API', async () => {
    // Login first
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user1@test.com', password: 'password' });
    
    const cookie = loginRes.headers['set-cookie'];
    
    // Send friend request
    const res = await request(app)
      .post('/api/friends/request')
      .set('Cookie', cookie)
      .send({ toUserId: 'user-2' });
    
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('pending');
  });
});
```

### Test Coverage Requirements
- **Minimum 70% coverage** for service layer
- **100% coverage** for critical paths (auth, payments, data export)
- **Integration tests** for all API endpoints
- **E2E tests** for critical user flows

### Running Tests
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run specific test file
vitest server/friend-service.test.ts

# Run tests matching pattern
vitest --run -t "should send friend request"
```

---

## Service Layer Patterns

### Service Structure
```typescript
/**
 * Friend Management Service
 * Implements Requirements: 1.2, 1.4, 1.5, 2.1
 * 
 * Handles:
 * - Friend request sending and receiving
 * - Accept/decline workflows
 * - Friendship status validation
 */
export class FriendService {
  private db = getDatabase();

  /**
   * Send a friend request
   * Requirements: 1.2 - Friend request creation
   * 
   * @param fromUserId - ID of user sending request
   * @param toUserId - ID of user receiving request
   * @returns Promise<FriendRequest>
   * @throws Error if users are blocked or already friends
   */
  async sendFriendRequest(fromUserId: string, toUserId: string): Promise<FriendRequest> {
    // Implementation
  }
}

// Export singleton instance
export const friendService = new FriendService();
```

### Service Dependencies
```typescript
// ✅ Good: Inject dependencies, avoid circular imports
export class CommentService {
  constructor(
    private db = getDatabase(),
    private privacyService = privacyService,
    private notificationService = notificationService
  ) {}
}

// ❌ Bad: Direct imports create circular dependencies
import { friendService } from './friend-service';
```

### Error Handling in Services
```typescript
// ✅ Good: Descriptive errors with context
if (!user) {
  throw new Error(`User not found: ${userId}`);
}

if (friendship.status !== 'pending') {
  throw new Error('Friend request is no longer pending');
}

// ❌ Bad: Generic errors
throw new Error('Invalid request');
```

---

## API Design Standards

### RESTful Conventions
```
GET    /api/friends              # List friends
POST   /api/friends/request      # Send friend request
POST   /api/friends/:id/accept   # Accept request
DELETE /api/friends/:id          # Unfriend

GET    /api/articles             # List articles
GET    /api/articles/:id         # Get article
POST   /api/articles/:id/read    # Mark as read
POST   /api/articles/:id/star    # Star article
```

### Request Validation
```typescript
// ✅ Good: Validate before processing
app.post('/api/friends/request', requireAuth, async (req, res) => {
  try {
    const { toUserId } = z.object({
      toUserId: z.string().uuid()
    }).parse(req.body);
    
    const request = await friendService.sendFriendRequest(req.user!.id, toUserId);
    res.json({ request });
  } catch (error) {
    // Error handling
  }
});
```

### Pagination
```typescript
// ✅ Good: Consistent pagination pattern
interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

app.get('/api/articles', requireAuth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  const articles = await storage.getArticles({
    userId: req.user!.id,
    offset: (page - 1) * limit,
    limit
  });
  
  res.json({
    articles,
    pagination: {
      page,
      limit,
      total: articles.length
    }
  });
});
```

---

## Security Best Practices

### Authentication
- Use Passport.js with Supabase Auth
- Store sessions in database (not memory)
- Implement session health checks
- Support both email/password and OAuth

### Authorization
```typescript
// ✅ Good: Check ownership before operations
app.delete('/api/feeds/:id', requireAuth, async (req, res) => {
  const feedId = req.params.id;
  const userId = req.user!.id;
  
  // Verify ownership
  const feed = await storage.getFeed(feedId);
  if (feed.user_id !== userId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not own this feed'
    });
  }
  
  await storage.deleteFeed(feedId);
  res.json({ success: true });
});
```

### Input Sanitization
```typescript
// ✅ Good: Sanitize user input
import { z } from 'zod';

const commentSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment too long')
});
```

### SQL Injection Prevention
```typescript
// ✅ Good: Use Drizzle ORM parameterized queries
const articles = await db
  .select()
  .from(articles)
  .where(eq(articles.user_id, userId));

// ❌ Bad: Raw SQL with string interpolation
const articles = await db.execute(
  sql`SELECT * FROM articles WHERE user_id = '${userId}'`
);
```

### Rate Limiting
```typescript
// Implement rate limiting for AI operations
export class AIRateLimiter {
  async checkLimit(userId: string, operation: AIOperation): Promise<boolean> {
    const usage = await this.getDailyUsage(userId);
    const limit = await this.getLimit(userId, operation);
    return usage[operation] < limit;
  }
}
```

---

## Code Review Checklist

Before submitting code, ensure:

- [ ] TypeScript strict mode passes with no errors
- [ ] All functions have explicit return types
- [ ] Zod schemas validate all API inputs
- [ ] Error handling covers all edge cases
- [ ] Tests cover new functionality (min 70% coverage)
- [ ] No `any` types used
- [ ] Database queries use Drizzle ORM (no raw SQL)
- [ ] Authentication/authorization checks in place
- [ ] API responses follow consistent structure
- [ ] Comments explain complex logic
- [ ] No console.logs in production code (use proper logging)
- [ ] Environment variables documented in `.env.example`
- [ ] Migrations tested locally before commit

---

## Common Patterns Reference

### Async/Await
```typescript
// ✅ Good: Proper error handling
async function fetchUserData(userId: string): Promise<UserData> {
  try {
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new Error('User not found');
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
  }
}
```

### Promise.all for Parallel Operations
```typescript
// ✅ Good: Parallel fetching
const [user, settings, friends] = await Promise.all([
  storage.getUser(userId),
  storage.getUserSettings(userId),
  friendService.getFriends(userId)
]);
```

### Optional Chaining
```typescript
// ✅ Good: Safe property access
const avatarUrl = user?.profile?.avatar_url ?? '/default-avatar.png';
```

### Nullish Coalescing
```typescript
// ✅ Good: Default values
const limit = req.query.limit ?? 20;
const theme = settings.theme ?? 'system';
```

---

## Additional Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Vitest Documentation](https://vitest.dev/)
- [TanStack Query Guide](https://tanstack.com/query/latest)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Last Updated**: January 2026  
**Maintained By**: Cronkite Development Team
