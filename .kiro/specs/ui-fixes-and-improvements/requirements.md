# Requirements Document

## Introduction

This document specifies requirements for fixing several UI/UX issues in the Cronkite news aggregation application:
1. 500 error when adding a new source via custom URL
2. Star and X buttons should be always visible, not just on hover
3. Thumbs up/down engagement buttons should be separate from Star and X
4. Trending topic cards should be integrated into the main feed

## Glossary

- **Article_Card**: A UI component that displays an article with title, excerpt, source, and action buttons
- **Trending_Topic_Card**: A UI component that displays AI-clustered trending topics with summary and article count
- **Feed**: A collection of articles from an RSS/Atom source
- **Custom_Feed**: A user-provided RSS/Atom feed URL not in the recommended feeds list
- **Engagement_Signal**: User feedback (thumbs up/down) indicating content preference
- **Star**: User action to save an article for later reading
- **Remove**: User action to hide an article from their feed

## Requirements

### Requirement 1: Fix Custom Feed Addition 500 Error

**User Story:** As a user, I want to add custom RSS feed URLs so that I can subscribe to sources not in the recommended list.

#### Acceptance Criteria

1. WHEN a user validates a custom feed URL, THE Feed_Validator SHALL verify the URL is a valid RSS/Atom feed
2. WHEN a user submits a valid custom feed, THE System SHALL create a new feed entry in the database
3. WHEN a custom feed is created, THE System SHALL return the feed ID to the client
4. WHEN a user subscribes to the custom feed, THE System SHALL add the subscription to the user's feed list
5. IF the custom feed URL is invalid, THEN THE System SHALL return a descriptive error message
6. IF the database operation fails, THEN THE System SHALL return a 500 error with details for debugging

### Requirement 2: Always Visible Star and Remove Buttons

**User Story:** As a user, I want to see the Star and Remove buttons at all times so that I can quickly interact with articles without hovering.

#### Acceptance Criteria

1. THE Article_Card SHALL display the Star button visibly at all times
2. THE Article_Card SHALL display the Remove (X) button visibly at all times
3. WHEN an article is starred, THE Star button SHALL display a filled star icon with yellow color
4. WHEN an article is not starred, THE Star button SHALL display an outline star icon
5. THE Star and Remove buttons SHALL maintain their current position in the card footer
6. THE Star and Remove buttons SHALL have sufficient contrast against the card background

### Requirement 3: Separate Engagement Buttons from Star and Remove

**User Story:** As a user, I want thumbs up/down buttons to be visually separate from Star and Remove so that I can distinguish between saving content and providing feedback.

#### Acceptance Criteria

1. THE Article_Card SHALL display thumbs up and thumbs down buttons in a separate group from Star and Remove
2. THE Engagement buttons (thumbs up/down) SHALL appear on the left side of the action button row
3. THE Star and Remove buttons SHALL appear on the right side of the action button row
4. WHEN a user clicks thumbs up, THE System SHALL record a positive engagement signal
5. WHEN a user clicks thumbs down, THE System SHALL record a negative engagement signal
6. THE Engagement buttons SHALL be always visible, not just on hover
7. WHEN an engagement signal is active, THE corresponding button SHALL display a filled icon with appropriate color

### Requirement 4: Trending Topic Cards in Feed

**User Story:** As a user, I want to see trending topic cards interspersed in my article feed so that I can discover related content clusters.

#### Acceptance Criteria

1. THE Home page SHALL display Trending_Topic_Cards interspersed with Article_Cards in the masonry grid
2. THE System SHALL insert a Trending_Topic_Card approximately every 5 articles
3. WHEN displaying trending cards, THE System SHALL use varying card variants (compact, expanded, summary) for visual variety
4. WHEN a user clicks a Trending_Topic_Card, THE System SHALL open the TrendingClusterSheet with full details
5. WHEN filtering by source or category, THE System SHALL hide Trending_Topic_Cards from the feed
6. WHEN filtering by status (unread/starred), THE System SHALL hide Trending_Topic_Cards from the feed
7. THE Trending_Topic_Cards SHALL match the visual style of the existing TrendingTopicCard component
