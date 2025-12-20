# Requirements Document

## Introduction

This specification defines the database schema implementation for Cronkite, an AI-powered RSS news aggregation platform. The system requires a comprehensive PostgreSQL database schema using Supabase for authentication and database hosting, supporting user management, feed subscriptions, article storage, AI-powered clustering, and personalized reading experiences.

## Glossary

- **Supabase**: Backend-as-a-Service platform providing PostgreSQL database and authentication
- **RSS Feed**: Really Simple Syndication feed for content distribution
- **RLS**: Row Level Security for database access control
- **AI Clustering**: Automated grouping of related articles using artificial intelligence
- **Digest**: Curated summary of articles delivered to users
- **pgvector**: PostgreSQL extension for vector similarity search
- **GUID**: Globally Unique Identifier from RSS feeds
- **ETL**: Extract, Transform, Load process for feed synchronization

## Requirements

### Requirement 1

**User Story:** As a new user, I want my profile to be automatically created when I sign up, so that I can immediately start using the application with my preferences.

#### Acceptance Criteria

1. WHEN a user signs up through Supabase Auth, THE System SHALL automatically create a corresponding profile record
2. WHEN creating a profile, THE System SHALL populate the display name from user metadata or email prefix
3. WHEN a profile is created, THE System SHALL set default values for timezone and onboarding status
4. WHEN a user is deleted from auth, THE System SHALL cascade delete their profile and all related data
5. THE System SHALL ensure each profile references a valid Supabase auth user

### Requirement 2

**User Story:** As a user, I want to organize my RSS feeds into folders, so that I can categorize and manage my subscriptions efficiently.

#### Acceptance Criteria

1. WHEN a user creates a folder, THE System SHALL store the folder with a unique name per user
2. WHEN a user assigns feeds to folders, THE System SHALL maintain the folder-feed relationship
3. WHEN a folder is deleted, THE System SHALL set associated feeds' folder reference to null
4. THE System SHALL support folder positioning for custom ordering
5. THE System SHALL allow folders to have custom icons and names

### Requirement 3

**User Story:** As a user, I want to subscribe to RSS feeds with different priorities and settings, so that I can control how frequently they are checked and how important they are.

#### Acceptance Criteria

1. WHEN a user adds an RSS feed, THE System SHALL store the feed URL and prevent duplicates per user
2. WHEN storing feed information, THE System SHALL capture metadata including name, description, and icon
3. WHEN a feed has errors, THE System SHALL track the error status and message
4. THE System SHALL support feed priority levels of high, medium, and low
5. THE System SHALL allow custom polling intervals per feed
6. THE System SHALL track ETL metadata including etag and last-modified headers

### Requirement 4

**User Story:** As a user, I want articles from my subscribed feeds to be stored with their content and metadata, so that I can read them even when offline.

#### Acceptance Criteria

1. WHEN articles are fetched from feeds, THE System SHALL store them with unique identification per feed
2. WHEN storing articles, THE System SHALL capture title, URL, author, excerpt, and full content
3. WHEN articles have images, THE System SHALL store the image URL
4. THE System SHALL track article publication dates and fetch timestamps
5. THE System SHALL support AI-generated summaries and embeddings for semantic search
6. THE System SHALL prevent duplicate articles using feed GUID

### Requirement 5

**User Story:** As a user, I want to mark articles as read or starred, so that I can track my reading progress and save important articles.

#### Acceptance Criteria

1. WHEN a user interacts with an article, THE System SHALL create or update their article state
2. WHEN marking articles as read, THE System SHALL record the timestamp
3. WHEN starring articles, THE System SHALL record the starred timestamp
4. THE System SHALL track user engagement metrics including click time and reading duration
5. THE System SHALL ensure each user-article relationship is unique

### Requirement 6

**User Story:** As a user, I want to configure my reading preferences and feed settings, so that I can customize my news consumption experience.

#### Acceptance Criteria

1. WHEN a user modifies settings, THE System SHALL store all preference categories in a single settings record
2. THE System SHALL support polling interval configuration with adaptive polling options
3. THE System SHALL support digest delivery preferences including timing and content selection
4. THE System SHALL support AI feature toggles for summaries and clustering
5. THE System SHALL support appearance preferences including theme and accent color
6. THE System SHALL provide default values for all settings

### Requirement 7

**User Story:** As a user completing onboarding, I want my interests and region to be stored, so that the system can recommend relevant feeds and content.

#### Acceptance Criteria

1. WHEN a user selects interests during onboarding, THE System SHALL store each category selection
2. WHEN a user selects their region, THE System SHALL store the region code in their profile
3. THE System SHALL prevent duplicate interest selections per user
4. THE System SHALL track when interests were selected
5. THE System SHALL support multiple interest categories per user

### Requirement 8

**User Story:** As a user, I want access to a curated directory of recommended feeds, so that I can discover high-quality content sources in my areas of interest.

#### Acceptance Criteria

1. THE System SHALL maintain a public directory of recommended RSS feeds
2. WHEN storing recommended feeds, THE System SHALL categorize them by topic and region
3. THE System SHALL track feed popularity and article frequency metrics
4. THE System SHALL support tagging for improved discoverability
5. THE System SHALL allow filtering by category, country, and language

### Requirement 9

**User Story:** As a user, I want related articles to be automatically grouped into topic clusters, so that I can efficiently consume news on similar subjects.

#### Acceptance Criteria

1. WHEN AI clustering runs, THE System SHALL create cluster records with generated titles and summaries
2. WHEN articles are clustered, THE System SHALL link them to the appropriate cluster
3. THE System SHALL track cluster timeframes and source feeds
4. THE System SHALL automatically expire old clusters to maintain performance
5. THE System SHALL count articles per cluster for display purposes

### Requirement 10

**User Story:** As a user, I want my AI usage to be tracked, so that the system can manage resource consumption and provide usage insights.

#### Acceptance Criteria

1. WHEN AI features are used, THE System SHALL increment daily usage counters
2. THE System SHALL track summary generation and clustering operations separately
3. THE System SHALL maintain daily usage records per user
4. THE System SHALL support usage limits and monitoring
5. THE System SHALL aggregate usage by date for reporting

### Requirement 11

**User Story:** As a user receiving digests, I want my digest history to be tracked, so that I can see what content was delivered and when.

#### Acceptance Criteria

1. WHEN a digest is sent, THE System SHALL record the delivery with included article references
2. THE System SHALL track digest delivery method and timing
3. WHEN users interact with digests, THE System SHALL record open and click metrics
4. THE System SHALL store AI-generated digest summaries
5. THE System SHALL maintain digest history for user reference

### Requirement 12

**User Story:** As a system administrator, I want feed synchronization to be logged, so that I can monitor system health and troubleshoot feed issues.

#### Acceptance Criteria

1. WHEN feeds are synchronized, THE System SHALL log each sync attempt with timing and status
2. WHEN sync errors occur, THE System SHALL record error messages and response codes
3. THE System SHALL track articles found and newly added per sync
4. THE System SHALL automatically clean up old sync logs to prevent storage bloat
5. THE System SHALL maintain the last 100 sync logs per feed

### Requirement 13

**User Story:** As a user, I want my data to be secure and private, so that only I can access my feeds, articles, and preferences.

#### Acceptance Criteria

1. THE System SHALL implement Row Level Security on all user-specific tables
2. WHEN users access data, THE System SHALL verify they own the requested records
3. THE System SHALL allow users to read articles only from their subscribed feeds
4. THE System SHALL permit public read access to recommended feeds directory
5. THE System SHALL cascade delete all user data when accounts are removed

### Requirement 14

**User Story:** As a developer, I want convenient database views and functions, so that I can efficiently query common data patterns and perform bulk operations.

#### Acceptance Criteria

1. THE System SHALL provide views for articles with feed information joined
2. THE System SHALL provide views for user article feeds with read/starred status
3. THE System SHALL provide views for unread counts by folder
4. THE System SHALL provide functions for calculating article relevancy scores
5. THE System SHALL provide functions for bulk operations like marking folders as read

### Requirement 15

**User Story:** As a system, I want to support semantic search capabilities, so that users can find articles based on content similarity and meaning.

#### Acceptance Criteria

1. WHEN pgvector extension is available, THE System SHALL support vector embeddings for articles
2. THE System SHALL create appropriate indexes for vector similarity search
3. THE System SHALL store 1536-dimensional embeddings for semantic matching
4. THE System SHALL support cosine similarity operations on embeddings
5. THE System SHALL integrate embedding generation with AI summary creation