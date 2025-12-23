# Requirements Document

## Introduction

This specification defines the AI-powered embeddings and topic clustering system for Cronkite. The system uses OpenAI for generating article embeddings and Anthropic for intelligent topic clustering. It includes priority-based feed scheduling, vector similarity recommendations, and semantic search capabilities. Embeddings and clusters update alongside feed syncs based on configurable priority levels.

## Glossary

- **Embedding_Service**: The OpenAI-powered service that generates 1536-dimensional vector embeddings for article content
- **Clustering_Service**: The Anthropic-powered service that groups semantically similar articles into topic clusters using vector embeddings
- **Feed_Scheduler**: The system component that manages feed sync timing based on priority levels
- **Vector_Search**: The pgvector-powered database function that finds similar articles using cosine similarity
- **Semantic_Search**: The search system that converts user queries to embeddings and finds matching articles
- **Priority_Level**: A feed classification (high, medium, low) that determines sync frequency
- **Topic_Cluster**: A group of semantically related articles from multiple sources covering the same story or theme
- **Similarity_Score**: A numeric value (0-1) representing how semantically similar two articles are

## Requirements

### Requirement 1: Article Embedding Generation

**User Story:** As a system, I want to generate vector embeddings for articles, so that I can enable semantic similarity features.

#### Acceptance Criteria

1. WHEN a new article is stored, THE Embedding_Service SHALL generate a 1536-dimensional embedding using OpenAI text-embedding-3-small model
2. WHEN the OpenAI API is unavailable, THE Embedding_Service SHALL queue the article for retry and log the failure
3. WHEN generating embeddings, THE Embedding_Service SHALL use the article title and excerpt concatenated as input text
4. THE Embedding_Service SHALL store embeddings in the articles table embedding column as VECTOR(1536)
5. WHEN an article already has an embedding, THE Embedding_Service SHALL skip regeneration unless content has changed
6. THE Embedding_Service SHALL process articles in batches of up to 100 to optimize API usage

### Requirement 2: Vector-Based Topic Clustering

**User Story:** As a user, I want to see trending topic clusters, so that I can discover related articles across different sources.

#### Acceptance Criteria

1. WHEN clustering is triggered, THE Clustering_Service SHALL group articles with similarity scores above 0.75 into clusters
2. WHEN forming clusters, THE Clustering_Service SHALL require at least 2 articles from different sources
3. WHEN a cluster is formed, THE Clustering_Service SHALL use Anthropic to generate a topic title and summary
4. THE Clustering_Service SHALL assign each article to at most one cluster
5. WHEN clusters are generated, THE Clustering_Service SHALL store them in the clusters table with article associations
6. THE Clustering_Service SHALL expire clusters after 48 hours and remove stale associations
7. WHEN displaying clusters, THE System SHALL sort by relevance score (article count × source diversity)

### Requirement 3: Priority-Based Feed Scheduling

**User Story:** As a system administrator, I want feeds to sync at different frequencies based on priority, so that breaking news sources update more frequently.

#### Acceptance Criteria

1. THE Feed_Scheduler SHALL sync high-priority feeds every 1 hour
2. THE Feed_Scheduler SHALL sync medium-priority feeds every 24 hours
3. THE Feed_Scheduler SHALL sync low-priority feeds every 7 days
4. WHEN a feed is created, THE System SHALL assign a default priority of medium
5. THE Feed_Scheduler SHALL allow manual sync triggers that bypass the schedule
6. WHEN a manual sync is triggered, THE Feed_Scheduler SHALL update both articles and clusters
7. THE System SHALL classify breaking news sources (NYT, BBC, CNN, Reuters, AP) as high-priority by default
8. WHEN a feed sync completes, THE Feed_Scheduler SHALL trigger embedding generation for new articles
9. WHEN embedding generation completes, THE Feed_Scheduler SHALL trigger cluster regeneration

### Requirement 4: Similar Article Recommendations

**User Story:** As a user, I want to see articles similar to the one I'm reading, so that I can explore related content.

#### Acceptance Criteria

1. WHEN viewing an article with an embedding, THE System SHALL display up to 5 similar articles
2. THE Vector_Search SHALL return articles with similarity scores above 0.7
3. THE Vector_Search SHALL exclude the current article from recommendations
4. THE Vector_Search SHALL only return articles from the user's subscribed feeds
5. WHEN no similar articles exist above the threshold, THE System SHALL display a message indicating no recommendations
6. THE System SHALL cache similarity results for 1 hour to reduce database load

### Requirement 5: Semantic Search

**User Story:** As a user, I want to search my articles using natural language, so that I can find relevant content without exact keyword matches.

#### Acceptance Criteria

1. WHEN a user enters a search query, THE Semantic_Search SHALL convert the query to an embedding using OpenAI
2. THE Semantic_Search SHALL return articles ranked by cosine similarity to the query embedding
3. THE Semantic_Search SHALL only search articles from the user's subscribed feeds
4. WHEN displaying search results, THE System SHALL show the similarity score as a relevance indicator
5. THE Semantic_Search SHALL return a maximum of 50 results per query
6. WHEN the search query is empty, THE System SHALL display the default article feed
7. THE Semantic_Search SHALL support filtering results by date range and feed source
8. IF the OpenAI API is unavailable, THEN THE System SHALL fall back to text-based search

### Requirement 6: Feed Priority Management

**User Story:** As a user, I want to set priority levels for my feeds, so that important sources update more frequently.

#### Acceptance Criteria

1. THE System SHALL display the current priority level for each feed in settings
2. WHEN a user changes a feed's priority, THE System SHALL update the sync schedule immediately
3. THE System SHALL provide three priority options: high (hourly), medium (daily), low (weekly)
4. WHEN displaying feeds, THE System SHALL show the last sync time and next scheduled sync
5. THE System SHALL allow bulk priority changes for multiple feeds
6. WHEN a recommended feed is subscribed, THE System SHALL inherit the default priority from the recommended_feeds table

### Requirement 7: Embedding and Cluster Synchronization

**User Story:** As a system, I want embeddings and clusters to stay synchronized with feed updates, so that AI features reflect current content.

#### Acceptance Criteria

1. WHEN a feed sync adds new articles, THE System SHALL queue those articles for embedding generation
2. WHEN embedding generation completes for a batch, THE System SHALL trigger cluster recalculation
3. THE System SHALL track embedding generation status per article (pending, completed, failed)
4. WHEN an article's content is updated, THE System SHALL regenerate its embedding
5. THE System SHALL provide an API endpoint to check embedding and clustering status
6. WHEN cluster recalculation runs, THE System SHALL preserve user-relevant cluster history for 7 days

### Requirement 8: API Rate Limiting and Cost Management

**User Story:** As a system administrator, I want to manage AI API usage, so that costs remain predictable.

#### Acceptance Criteria

1. THE System SHALL track daily API calls to OpenAI and Anthropic per user
2. THE System SHALL enforce a configurable daily embedding limit (default: 500 articles per day)
3. THE System SHALL enforce a configurable daily clustering limit (default: 10 cluster generations per day)
4. WHEN a user exceeds their daily limit, THE System SHALL queue requests for the next day
5. THE System SHALL log all API calls with timestamps, token counts, and costs
6. THE System SHALL provide usage statistics in the user settings page
7. IF API rate limits are exceeded, THEN THE System SHALL implement exponential backoff retry

### Requirement 9: Error Handling and Resilience

**User Story:** As a system, I want to handle AI service failures gracefully, so that the application remains functional.

#### Acceptance Criteria

1. IF the OpenAI API returns an error, THEN THE Embedding_Service SHALL retry up to 3 times with exponential backoff
2. IF the Anthropic API returns an error, THEN THE Clustering_Service SHALL retry up to 3 times with exponential backoff
3. WHEN all retries fail, THE System SHALL mark the operation as failed and continue processing other items
4. THE System SHALL maintain a dead letter queue for permanently failed operations
5. WHEN AI services are unavailable, THE System SHALL continue serving cached clusters and skip new generations
6. THE System SHALL alert administrators when error rates exceed 10% over a 1-hour window
