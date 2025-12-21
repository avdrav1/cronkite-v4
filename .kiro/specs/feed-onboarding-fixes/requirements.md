# Requirements Document

## Introduction

This document addresses three critical issues discovered in the feed onboarding and display flow:

1. **Category Loss**: After onboarding, all feeds appear as "Uncategorized" despite having categories during selection
2. **No Articles**: Feeds show no articles even after refresh/sync
3. **Onboarding UX**: Too many feeds per category makes it hard to find and select feeds

## Glossary

- **Feed**: An RSS feed source that users can subscribe to
- **Recommended_Feed**: A pre-seeded feed in the discovery catalog with category information
- **User_Feed**: A feed subscription in the user's `feeds` table
- **Category**: A topic classification (e.g., Technology, News, Sports)
- **Folder**: A user-created grouping mechanism for organizing feeds
- **folder_name**: A column in the feeds table that stores the category/folder name for display

## Requirements

### Requirement 1: Preserve Category During Feed Subscription

**User Story:** As a user, I want my subscribed feeds to retain their category from onboarding, so that I can see them organized by topic in my sidebar.

#### Acceptance Criteria

1. WHEN a user subscribes to feeds during onboarding, THE System SHALL copy the `category` field from `recommended_feeds` to the `folder_name` field in the user's `feeds` table
2. WHEN displaying feeds in the sidebar, THE System SHALL group feeds by their `folder_name` value
3. IF a feed has no `folder_name` value, THEN THE System SHALL display it under "Uncategorized"
4. WHEN a user subscribes to a feed with category "Technology", THE System SHALL set `folder_name` to "Technology" in the user's feed record

### Requirement 2: Fix Article Synchronization with Visual Feedback

**User Story:** As a user, I want to see articles from my subscribed feeds with clear visual feedback during loading, so that I understand when content is being fetched.

#### Acceptance Criteria

1. WHEN a user completes onboarding, THE System SHALL trigger RSS synchronization for all subscribed feeds
2. WHEN the sync endpoint is called, THE System SHALL fetch articles from each subscribed feed's RSS URL
3. WHEN articles are fetched successfully, THE System SHALL store them in the `articles` table linked to the feed
4. IF a feed sync fails, THEN THE System SHALL log the error and continue with other feeds
5. WHEN the user views their feed, THE System SHALL display articles in the masonry layout sorted by publication date (newest first)
6. WHILE feeds are being synchronized, THE System SHALL display a loading indicator in the masonry feed area with a message like "Fetching your articles..."
7. WHEN sync is in progress, THE System SHALL show a progress indicator (e.g., "Syncing 3 of 10 feeds...")
8. IF no articles are available after sync completes, THE System SHALL display a helpful empty state message explaining that articles will appear as feeds are updated
9. WHEN a sync error occurs, THE System SHALL display a user-friendly error message with a retry option

### Requirement 3: Improve Onboarding Feed Discovery UX

**User Story:** As a user, I want to easily find and select feeds during onboarding, so that I can quickly set up my personalized news experience.

#### Acceptance Criteria

1. WHEN displaying feeds for a category during onboarding, THE System SHALL show featured feeds first (sorted by popularity_score descending)
2. WHEN a category has more than 6 feeds, THE System SHALL initially show only the top 6 featured feeds
3. WHEN a user wants to see more feeds, THE System SHALL provide a "Show more" button to reveal additional feeds
4. THE System SHALL provide a search/filter input to find specific feeds within a category
5. WHEN displaying feed options, THE System SHALL show the feed name, description, and a visual indicator of popularity (e.g., star rating or badge)
6. THE System SHALL allow users to select/deselect feeds with a single click
