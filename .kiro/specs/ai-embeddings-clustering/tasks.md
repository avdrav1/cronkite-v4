# Implementation Plan: AI Embeddings and Topic Clustering

## Overview

This implementation plan builds the AI-powered embeddings and clustering system incrementally. We start with database schema updates, then implement core services (embedding, clustering, scheduling), followed by API endpoints and frontend integration. Each task builds on previous work, with property tests validating correctness at each stage.

## Tasks

- [x] 1. Database schema updates for AI features
  - [x] 1.1 Create migration for feed priority and scheduling columns
    - Add sync_priority, next_sync_at, sync_interval_hours to feeds table
    - Add default_priority to recommended_feeds table
    - Update high-priority sources (NYT, BBC, CNN, Reuters, AP)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [x] 1.2 Create migration for article embedding tracking
    - Add embedding_status, embedding_generated_at, embedding_error, content_hash to articles
    - Create embedding_queue table
    - Create indexes for embedding status queries
    - _Requirements: 1.4, 7.3_

  - [x] 1.3 Create migration for AI usage tracking
    - Create ai_usage_log table
    - Create ai_usage_daily table
    - Create indexes for usage queries
    - _Requirements: 8.1, 8.5_

  - [x] 1.4 Update shared schema types
    - Add new table definitions to shared/schema.ts
    - Add type exports for new tables
    - Update feed type with priority fields
    - _Requirements: 3.4, 7.3, 8.1_

- [x] 2. Implement Embedding Service
  - [x] 2.1 Create OpenAI embedding client
    - Initialize OpenAI client with API key
    - Implement generateEmbedding function using text-embedding-3-small
    - Handle API errors and rate limits
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Implement embedding generation logic
    - Concatenate title and excerpt for input text
    - Generate content hash for change detection
    - Store embedding in database
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]* 2.3 Write property test for embedding dimensions
    - **Property 1: Embedding Dimension Invariant**
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 2.4 Write property test for embedding input format
    - **Property 2: Embedding Input Format Consistency**
    - **Validates: Requirements 1.3**

  - [x] 2.5 Implement batch embedding processing
    - Process articles in batches of up to 100
    - Track progress and handle partial failures
    - _Requirements: 1.6_

  - [ ]* 2.6 Write property test for batch size limit
    - **Property 4: Batch Size Limit**
    - **Validates: Requirements 1.6**

  - [x] 2.7 Implement embedding queue management
    - Queue articles for embedding generation
    - Process queue with priority ordering
    - Handle retries for failed embeddings
    - _Requirements: 1.2, 7.1_

  - [ ]* 2.8 Write property test for embedding idempotence
    - **Property 3: Embedding Idempotence on Unchanged Content**
    - **Validates: Requirements 1.5**

- [x] 3. Checkpoint - Embedding service complete
  - Ensure all embedding tests pass, ask the user if questions arise.

- [x] 4. Implement Clustering Service
  - [x] 4.1 Create vector similarity functions
    - Implement cosine similarity calculation
    - Create function to find similar articles by embedding
    - Use pgvector operators for efficient search
    - _Requirements: 2.1, 4.2_

  - [x] 4.2 Implement cluster formation logic
    - Group articles with similarity >= 0.75
    - Require minimum 2 articles from 2 sources
    - Assign articles to at most one cluster
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 4.3 Write property test for cluster similarity threshold
    - **Property 5: Cluster Similarity Threshold**
    - **Validates: Requirements 2.1**

  - [ ]* 4.4 Write property test for cluster source diversity
    - **Property 6: Cluster Source Diversity**
    - **Validates: Requirements 2.2**

  - [ ]* 4.5 Write property test for single-cluster assignment
    - **Property 7: Article Single-Cluster Assignment**
    - **Validates: Requirements 2.4**

  - [x] 4.6 Implement Anthropic cluster labeling
    - Generate topic title and summary using Anthropic
    - Handle API errors with fallback to first article title
    - _Requirements: 2.3_

  - [x] 4.7 Implement cluster storage and expiration
    - Store clusters with article associations
    - Calculate and store relevance scores
    - Expire clusters after 48 hours
    - _Requirements: 2.5, 2.6, 2.7_

  - [ ]* 4.8 Write property test for cluster relevance sorting
    - **Property 8: Cluster Relevance Score Sorting**
    - **Validates: Requirements 2.7**

- [x] 5. Checkpoint - Clustering service complete
  - Ensure all clustering tests pass, ask the user if questions arise.

- [x] 6. Implement Feed Scheduler
  - [x] 6.1 Create priority-based scheduling logic
    - Calculate next_sync_at based on priority
    - Implement getFeedsDueForSync function
    - Handle schedule updates on priority change
    - _Requirements: 3.1, 3.2, 3.3, 6.2_

  - [ ]* 6.2 Write property test for priority-based sync interval
    - **Property 9: Priority-Based Sync Interval**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 6.3 Implement default priority assignment
    - Set medium priority for new feeds
    - Detect breaking news sources and set high priority
    - Inherit priority from recommended_feeds on subscribe
    - _Requirements: 3.4, 3.7, 6.6_

  - [ ]* 6.4 Write property test for default priority assignment
    - **Property 10: Default Priority Assignment**
    - **Validates: Requirements 3.4, 3.7**

  - [ ]* 6.5 Write property test for recommended feed priority inheritance
    - **Property 15: Recommended Feed Priority Inheritance**
    - **Validates: Requirements 6.6**

  - [x] 6.6 Implement sync-to-embedding pipeline
    - Trigger embedding queue after feed sync
    - Trigger clustering after embedding batch completes
    - Support manual sync triggers
    - _Requirements: 3.5, 3.6, 3.8, 3.9_

  - [ ]* 6.7 Write property test for feed sync triggers embedding queue
    - **Property 11: Feed Sync Triggers Embedding Queue**
    - **Validates: Requirements 3.8, 7.1**

- [x] 7. Checkpoint - Feed scheduler complete
  - Ensure all scheduler tests pass, ask the user if questions arise.

- [x] 8. Implement Similar Articles Feature
  - [x] 8.1 Create similar articles search function
    - Find articles with similarity >= 0.7
    - Exclude source article from results
    - Limit to user's subscribed feeds
    - Return max 5 results
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 8.2 Write property test for similar articles constraints
    - **Property 12: Similar Articles Search Constraints**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 8.3 Implement similarity caching
    - Cache results for 1 hour
    - Invalidate on new embeddings
    - _Requirements: 4.6_

  - [x] 8.4 Create API endpoint for similar articles
    - GET /api/articles/:id/similar
    - Return similar articles with scores
    - Handle no-results case
    - _Requirements: 4.1, 4.5_

- [x] 9. Implement Semantic Search
  - [x] 9.1 Create query embedding function
    - Convert search query to embedding using OpenAI
    - Cache query embeddings for repeated searches
    - _Requirements: 5.1_

  - [x] 9.2 Implement semantic search logic
    - Search by cosine similarity to query embedding
    - Filter by user's feeds, date range, feed source
    - Sort by similarity descending
    - Limit to 50 results
    - _Requirements: 5.2, 5.3, 5.5, 5.7_

  - [ ]* 9.3 Write property test for semantic search constraints
    - **Property 13: Semantic Search Result Constraints**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.7**

  - [x] 9.4 Implement text search fallback
    - Fall back to text search when OpenAI unavailable
    - Use PostgreSQL full-text search
    - _Requirements: 5.8_

  - [x] 9.5 Create API endpoint for semantic search
    - GET /api/search?q=query&feedId=&dateFrom=&dateTo=
    - Return articles with relevance scores
    - Handle empty query (return default feed)
    - _Requirements: 5.1, 5.6_

- [x] 10. Checkpoint - Search features complete
  - Ensure all search tests pass, ask the user if questions arise.

- [x] 11. Implement Rate Limiting and Usage Tracking
  - [x] 11.1 Create usage tracking functions
    - Record API calls with token counts and costs
    - Aggregate daily usage per user
    - _Requirements: 8.1, 8.5_

  - [ ]* 11.2 Write property test for API usage tracking
    - **Property 17: API Usage Tracking Completeness**
    - **Validates: Requirements 8.1, 8.5**

  - [x] 11.3 Implement daily limit enforcement
    - Check limits before API calls
    - Queue excess requests for next day
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ]* 11.4 Write property test for daily limit enforcement
    - **Property 18: Daily Limit Enforcement**
    - **Validates: Requirements 8.2, 8.3, 8.4**

  - [x] 11.5 Implement exponential backoff retry
    - Retry failed API calls with 1s, 2s, 4s delays
    - Stop after 3 attempts
    - _Requirements: 8.7, 9.1, 9.2_

  - [ ]* 11.6 Write property test for exponential backoff
    - **Property 19: Exponential Backoff Retry Pattern**
    - **Validates: Requirements 8.7, 9.1, 9.2**

  - [x] 11.7 Implement failure handling
    - Continue processing on individual failures
    - Move permanently failed items to dead letter queue
    - _Requirements: 9.3, 9.4_

  - [ ]* 11.8 Write property test for failure handling
    - **Property 20: Failure Handling Continuation**
    - **Validates: Requirements 9.3, 9.4**

- [x] 12. Checkpoint - Rate limiting complete
  - Ensure all rate limiting tests pass, ask the user if questions arise.

- [x] 13. Implement API Routes
  - [x] 13.1 Update clusters API endpoint
    - Modify GET /api/clusters to use vector-based clustering
    - Return clusters with relevance scores
    - _Requirements: 2.5, 2.7_

  - [x] 13.2 Create feed priority API endpoints
    - PUT /api/feeds/:id/priority - update single feed priority
    - PUT /api/feeds/priority - bulk update priorities
    - GET /api/feeds/schedule - get sync schedule
    - _Requirements: 6.2, 6.3, 6.5_

  - [ ]* 13.3 Write property test for priority change schedule update
    - **Property 14: Priority Change Schedule Update**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 13.4 Create AI status API endpoint
    - GET /api/ai/status - embedding and clustering status
    - GET /api/ai/usage - user's usage statistics
    - _Requirements: 7.5, 8.6_

  - [ ]* 13.5 Write property test for embedding status tracking
    - **Property 16: Embedding Status State Machine**
    - **Validates: Requirements 7.3, 7.4**

- [x] 14. Implement Frontend Components
  - [x] 14.1 Update TrendingClusters component
    - Display vector-based clusters
    - Show relevance scores and source diversity
    - _Requirements: 2.7_

  - [x] 14.2 Create SimilarArticles component
    - Display similar articles in article sheet
    - Show similarity scores
    - Handle no-results state
    - _Requirements: 4.1, 4.5_

  - [x] 14.3 Implement semantic search in navigation
    - Add search input to header
    - Display search results with relevance
    - Handle loading and error states
    - _Requirements: 5.1, 5.4, 5.6_

  - [x] 14.4 Add feed priority controls to settings
    - Display current priority per feed
    - Allow priority changes
    - Show sync schedule
    - _Requirements: 6.1, 6.4_

  - [x] 14.5 Add AI usage display to settings
    - Show daily usage statistics
    - Display remaining limits
    - _Requirements: 8.6_

- [x] 15. Integration and Wiring
  - [x] 15.1 Wire feed sync to embedding pipeline
    - Update RSS sync to queue new articles
    - Trigger clustering after embedding batches
    - _Requirements: 3.8, 3.9, 7.1, 7.2_

  - [x] 15.2 Update feed subscription flow
    - Inherit priority from recommended_feeds
    - Schedule initial sync based on priority
    - _Requirements: 6.6_

  - [x] 15.3 Implement graceful degradation
    - Serve cached clusters on AI failure
    - Fall back to text search
    - _Requirements: 5.8, 9.5_

- [x] 16. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout with Drizzle ORM for database operations
