# Database Schema Design Document

## Overview

The Cronkite database schema is designed as a comprehensive PostgreSQL database hosted on Supabase, supporting a full-featured RSS news aggregation platform. The schema leverages Supabase's built-in authentication system and extends it with a rich data model supporting user profiles, feed management, article storage, AI-powered features, and personalized reading experiences.

The design emphasizes data integrity, performance, and security through proper indexing, foreign key constraints, Row Level Security (RLS), and efficient query patterns. The schema supports both real-time user interactions and background processing for feed synchronization and AI operations.

## Architecture

### Database Platform
- **PostgreSQL** via Supabase with built-in authentication
- **Row Level Security (RLS)** for data isolation
- **pgvector extension** for semantic search capabilities
- **Triggers and functions** for automated data management

### Data Flow Architecture
```
User Authentication (Supabase Auth)
    ↓
Profile Creation (Automatic Trigger)
    ↓
Feed Subscription & Organization
    ↓
Background Feed Synchronization
    ↓
Article Storage & AI Processing
    ↓
User Reading & Interaction Tracking
    ↓
AI Clustering & Digest Generation
```

### Security Model
- Supabase Auth provides user authentication and session management
- RLS policies ensure users can only access their own data
- Cascade deletes maintain referential integrity
- Public access limited to recommended feeds directory

## Components and Interfaces

### Core User Management
- **profiles**: Extends Supabase auth.users with application-specific data
- **user_settings**: Comprehensive preference storage
- **user_interests**: Onboarding interest selections
- **user_articles**: Per-user article state (read/starred)

### Feed Management System
- **folders**: Hierarchical feed organization
- **feeds**: RSS subscription management with status tracking
- **recommended_feeds**: Curated feed directory for discovery

### Content Storage
- **articles**: Article content with AI enhancement fields
- **clusters**: AI-generated topic groupings
- **digest_history**: Email digest tracking

### System Operations
- **feed_sync_log**: Feed polling history and error tracking
- **ai_usage**: Daily AI operation limits and monitoring

### Database Views
- **articles_with_feed**: Articles joined with feed metadata
- **user_article_feed**: Complete user reading interface
- **folder_unread_counts**: Folder-based unread counters
- **feed_stats**: Per-feed statistics and health metrics

## Data Models

### User Profile Model
```sql
profiles {
  id: UUID (PK, FK to auth.users)
  email: TEXT
  display_name: TEXT
  avatar_url: TEXT
  timezone: TEXT (default: 'America/New_York')
  region_code: TEXT
  onboarding_completed: BOOLEAN (default: FALSE)
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

### Feed Subscription Model
```sql
feeds {
  id: UUID (PK)
  user_id: UUID (FK to profiles)
  folder_id: UUID (FK to folders, nullable)
  name: TEXT
  url: TEXT (unique per user)
  site_url: TEXT
  description: TEXT
  icon_url: TEXT
  icon_color: TEXT
  status: ENUM('active', 'paused', 'error')
  priority: ENUM('high', 'medium', 'low')
  custom_polling_interval: INTEGER
  last_fetched_at: TIMESTAMPTZ
  etag: TEXT
  last_modified: TEXT
  article_count: INTEGER
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

### Article Content Model
```sql
articles {
  id: UUID (PK)
  feed_id: UUID (FK to feeds)
  guid: TEXT (unique per feed)
  title: TEXT
  url: TEXT
  author: TEXT
  excerpt: TEXT
  content: TEXT
  image_url: TEXT
  published_at: TIMESTAMPTZ
  fetched_at: TIMESTAMPTZ
  ai_summary: TEXT
  ai_summary_generated_at: TIMESTAMPTZ
  embedding: VECTOR(1536)
  cluster_id: UUID (FK to clusters)
  created_at: TIMESTAMPTZ
}
```

### User Interaction Model
```sql
user_articles {
  id: UUID (PK)
  user_id: UUID (FK to profiles)
  article_id: UUID (FK to articles)
  is_read: BOOLEAN (default: FALSE)
  read_at: TIMESTAMPTZ
  is_starred: BOOLEAN (default: FALSE)
  starred_at: TIMESTAMPTZ
  clicked_at: TIMESTAMPTZ
  time_spent_seconds: INTEGER
  created_at: TIMESTAMPTZ
  updated_at: TIMESTAMPTZ
}
```

## Error Handling

### Database Constraints
- **Foreign Key Constraints**: Ensure referential integrity across all relationships
- **Unique Constraints**: Prevent duplicate feeds per user and duplicate user-article relationships
- **Check Constraints**: Validate enum values and data ranges
- **Not Null Constraints**: Ensure required fields are populated

### Cascade Behaviors
- **User Deletion**: CASCADE delete profiles, feeds, articles, settings, and all related data
- **Feed Deletion**: CASCADE delete articles and sync logs
- **Folder Deletion**: SET NULL on associated feeds to preserve feed subscriptions

### Error Recovery
- **Feed Sync Errors**: Captured in feed_sync_log with error messages and response codes
- **AI Processing Errors**: Logged with timestamps for retry mechanisms
- **Data Validation**: Zod schemas for type safety at application layer

### Automatic Cleanup
- **Sync Log Rotation**: Automatic cleanup keeping last 100 logs per feed
- **Cluster Expiration**: Time-based cleanup of old topic clusters
- **Orphaned Data**: Cascade deletes prevent orphaned records

## Testing Strategy

### Unit Testing Approach
- **Schema Validation**: Test all table constraints and relationships
- **Trigger Functions**: Verify automatic profile creation and cleanup operations
- **RLS Policies**: Test security boundaries and access controls
- **Database Functions**: Validate relevancy scoring and bulk operations
- **View Queries**: Ensure correct data joins and aggregations

### Property-Based Testing Approach
The testing strategy will use **pgTAP** for PostgreSQL-specific property-based testing, configured to run a minimum of 100 iterations per property test. Each property-based test will be tagged with comments referencing the specific correctness property from this design document.

**Testing Framework**: pgTAP for PostgreSQL unit testing and property verification
**Minimum Iterations**: 100 per property-based test
**Test Tagging Format**: `-- Feature: database-schema, Property {number}: {property_text}`

Property-based tests will verify universal properties that should hold across all valid database operations, while unit tests will cover specific examples, edge cases, and integration points between database components.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties can be consolidated to eliminate redundancy:

- Properties 4.1 and 4.6 both test unique constraints on (feed_id, guid) - combined into Property 4
- Multiple properties test basic field storage - consolidated where they share the same underlying mechanism
- Properties testing similar constraint behaviors are grouped together

### Core Database Properties

**Property 1: Automatic profile creation**
*For any* user created in Supabase auth.users, a corresponding profile record should be automatically created with populated display name and default values
**Validates: Requirements 1.1, 1.2, 1.3**

**Property 2: Cascade deletion integrity**
*For any* user deletion from auth.users, all related data (profile, feeds, articles, settings, etc.) should be completely removed from the database
**Validates: Requirements 1.4, 13.5**

**Property 3: User data isolation**
*For any* user attempting to access data, they should only be able to read/modify records they own, except for public recommended feeds
**Validates: Requirements 13.1, 13.2, 13.3, 13.4**

**Property 4: Unique constraint enforcement**
*For any* user, duplicate feed URLs, folder names, interest categories, and article GUIDs per feed should be rejected while allowing duplicates across different users
**Validates: Requirements 2.1, 3.1, 4.1, 4.6, 5.5, 7.3, 10.3**

**Property 5: Foreign key relationship integrity**
*For any* record with foreign key relationships, the referenced records should exist and cascade behaviors (DELETE CASCADE, SET NULL) should work correctly
**Validates: Requirements 1.5, 2.2, 2.3, 9.2**

**Property 6: Enum constraint validation**
*For any* field with enum constraints (feed_status, feed_priority), only valid enum values should be accepted
**Validates: Requirements 3.3, 3.4**

**Property 7: Timestamp tracking accuracy**
*For any* user action that should record timestamps (read_at, starred_at, clicked_at), the timestamp should be set when the corresponding boolean becomes true
**Validates: Requirements 5.2, 5.3, 7.4**

**Property 8: Default value consistency**
*For any* newly created record with default values, all specified defaults should be applied correctly
**Validates: Requirements 1.3, 6.6**

**Property 9: UPSERT behavior correctness**
*For any* operation requiring create-or-update logic (user_articles, ai_usage), the system should create new records when none exist and update existing records when they do
**Validates: Requirements 5.1, 10.1**

**Property 10: Array field functionality**
*For any* array field (tags, article_ids), values should be stored, retrieved, and searchable correctly
**Validates: Requirements 8.4, 11.1**

**Property 11: Aggregate calculation accuracy**
*For any* calculated aggregate (unread counts, article counts per cluster, usage totals), the computed values should match the actual count of underlying records
**Validates: Requirements 9.5, 10.5, 14.3**

**Property 12: View data consistency**
*For any* database view, the returned data should match what would be obtained by manually joining the underlying tables
**Validates: Requirements 14.1, 14.2**

**Property 13: Bulk operation correctness**
*For any* bulk operation function (mark folder as read), the operation should affect exactly the intended records and no others
**Validates: Requirements 14.5**

**Property 14: Automatic cleanup behavior**
*For any* table with automatic cleanup (feed_sync_log), old records should be removed according to the specified retention policy
**Validates: Requirements 12.4, 12.5**

**Property 15: Vector embedding storage**
*For any* article with AI processing, vector embeddings should be stored with correct dimensions and support similarity operations when pgvector is available
**Validates: Requirements 15.1, 15.2, 15.3, 15.4**

**Property 16: AI processing coordination**
*For any* article undergoing AI processing, summaries and embeddings should be generated and stored together with appropriate timestamps
**Validates: Requirements 4.5, 15.5**

**Property 17: Settings storage completeness**
*For any* user settings modification, all preference categories should be stored in a single record per user with proper field updates
**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**

**Property 18: Sync logging completeness**
*For any* feed synchronization operation, complete timing, status, error, and article count information should be logged
**Validates: Requirements 12.1, 12.2, 12.3**

**Property 19: Cluster lifecycle management**
*For any* AI clustering operation, clusters should be created with proper metadata, linked to articles, and expired according to time-based rules
**Validates: Requirements 9.1, 9.3, 9.4**

**Property 20: Digest tracking completeness**
*For any* digest delivery, the system should record delivery method, timing, included articles, and track user interactions
**Validates: Requirements 11.2, 11.3, 11.4, 11.5**