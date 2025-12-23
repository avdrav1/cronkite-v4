# Design Document: UI Fixes and Improvements

## Overview

This design addresses four UI/UX issues in the Cronkite application:
1. Custom feed addition returning 500 errors due to incomplete backend implementation
2. Star and Remove buttons only visible on hover, reducing discoverability
3. Engagement buttons (thumbs up/down) mixed with Star/Remove, causing confusion
4. Trending topic cards not integrated into the main article feed

## Architecture

The changes span both frontend and backend:

```mermaid
graph TB
    subgraph Frontend
        AC[ArticleCard] --> |always visible| SB[Star Button]
        AC --> |always visible| RB[Remove Button]
        AC --> |always visible| EB[Engagement Buttons]
        HP[Home Page] --> MG[MasonryGrid]
        MG --> AC
        MG --> TTC[TrendingTopicCard]
    end
    
    subgraph Backend
        CFE[/api/feeds/custom] --> FV[Feed Validator]
        FV --> DB[(Database)]
        CFE --> SUB[/api/feeds/subscribe]
    end
```

## Components and Interfaces

### 1. Custom Feed API Enhancement

The `/api/feeds/custom` endpoint needs to be enhanced to actually persist feeds to the database.

```typescript
// POST /api/feeds/custom request
interface CustomFeedRequest {
  url: string;
  name: string;
  description?: string;
  category?: string;
}

// POST /api/feeds/custom response
interface CustomFeedResponse {
  feedId: string;
  message: string;
  feed: {
    id: string;
    name: string;
    url: string;
    description: string;
    category: string;
  };
}
```

### 2. ArticleCard Button Layout

The ArticleCard component will be restructured to have always-visible buttons with clear separation:

```typescript
// Button layout structure
interface ArticleCardFooter {
  leftGroup: {
    engagementButtons: {
      thumbsUp: Button;
      thumbsDown: Button;
    };
  };
  rightGroup: {
    starButton: Button;
    removeButton: Button;
  };
}
```

### 3. Mixed Feed Integration

The Home page already has the infrastructure for mixed feeds. The TrendingTopicCard component exists and is imported but needs proper integration.

## Data Models

### Custom Feed Storage

Custom feeds will be stored in the existing `recommended_feeds` table with a flag indicating user-created feeds:

```typescript
interface CustomFeed {
  id: string;           // Generated UUID
  name: string;         // User-provided name
  url: string;          // RSS/Atom feed URL
  description: string;  // User-provided or auto-detected
  category: string;     // User-selected category
  is_custom: boolean;   // true for user-created feeds
  created_by: string;   // User ID who created the feed
  created_at: Date;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Custom Feed Round Trip

*For any* valid RSS/Atom feed URL, creating a custom feed and then subscribing to it should result in the feed appearing in the user's subscribed feeds list.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: Invalid Feed URL Rejection

*For any* invalid URL (malformed, non-RSS, unreachable), the feed validation endpoint should return an error response with a descriptive message.

**Validates: Requirements 1.5**

### Property 3: Engagement Signal Persistence

*For any* article and engagement signal (positive or negative), recording the signal and then fetching the article should return the same engagement signal.

**Validates: Requirements 3.4, 3.5**

### Property 4: Trending Card Insertion Frequency

*For any* feed with N articles and M trending clusters, the mixed feed should contain trending cards inserted approximately every 5 articles, with total trending cards equal to min(M, floor(N/5)).

**Validates: Requirements 4.1, 4.2**

### Property 5: Filter Exclusion of Trending Cards

*For any* filter (source, category, or status), when applied to the feed, the resulting items should contain zero trending topic cards.

**Validates: Requirements 4.5, 4.6**

## Error Handling

### Custom Feed Errors

| Error Condition | HTTP Status | Error Code | User Message |
|----------------|-------------|------------|--------------|
| Invalid URL format | 400 | INVALID_URL | "Please enter a valid URL" |
| URL not an RSS feed | 400 | NOT_RSS_FEED | "Could not find a valid RSS or Atom feed at this URL" |
| Feed already exists | 409 | FEED_EXISTS | "This feed has already been added" |
| Database error | 500 | DB_ERROR | "An error occurred. Please try again." |
| Network timeout | 504 | TIMEOUT | "Could not reach the feed URL. Please check the URL and try again." |

### Engagement Signal Errors

| Error Condition | HTTP Status | Error Code | User Message |
|----------------|-------------|------------|--------------|
| Article not found | 404 | ARTICLE_NOT_FOUND | "Article not found" |
| Invalid signal value | 400 | INVALID_SIGNAL | "Invalid engagement signal" |

## Testing Strategy

### Unit Tests

Unit tests will cover:
- ArticleCard button visibility (CSS class assertions)
- Button group separation (DOM structure assertions)
- Engagement button state changes
- Star button state changes

### Property-Based Tests

Property-based tests using Vitest with fast-check will validate:
- Custom feed creation round-trip (Property 1)
- Invalid URL rejection (Property 2)
- Engagement signal persistence (Property 3)
- Trending card insertion frequency (Property 4)
- Filter exclusion behavior (Property 5)

Each property test will run a minimum of 100 iterations to ensure comprehensive coverage.

### Integration Tests

Integration tests will verify:
- Full custom feed flow (validate → create → subscribe)
- ArticleCard interactions with API
- Home page feed composition with trending cards

## Implementation Notes

### ArticleCard Changes

The key changes to ArticleCard.tsx:
1. Remove `opacity-0 group-hover:opacity-100` classes from Star and Remove buttons
2. Move engagement buttons to a separate left-aligned group
3. Keep Star and Remove buttons in a right-aligned group
4. Ensure all buttons have consistent styling and spacing

### Backend Changes

The `/api/feeds/custom` endpoint needs:
1. Actual RSS feed validation (fetch and parse)
2. Database insertion into recommended_feeds table
3. Return the created feed object with ID

### Home Page Changes

The Home page already has:
- TrendingTopicCard import
- createMixedFeed function
- Cluster state management

The integration is mostly complete; we need to ensure clusters are being fetched and the mixed feed logic is working correctly.
