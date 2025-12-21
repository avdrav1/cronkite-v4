# Requirements Document

## Introduction

This feature focuses on two key improvements to the Cronkite news aggregation platform:
1. Identifying and prioritizing ~100 high-quality "flagship" news sources for enhanced maintenance while keeping all ~865 sources available
2. Removing all hardcoded/mock data from the left navigation sidebar and replacing it with the user's actual subscribed feeds from the database

## Glossary

- **Feed**: An RSS/Atom feed source that provides news articles
- **User_Feed**: A feed that a user has subscribed to
- **Category**: A grouping of feeds by topic (e.g., Tech, News, Business)
- **Sidebar**: The left navigation panel showing feeds and navigation options
- **Flagship_Feed**: A high-priority feed (~100 sources) that receives enhanced monitoring and maintenance
- **Recommended_Feed**: A curated feed available for users to subscribe to

## Requirements

### Requirement 1: Flagship Feed Identification

**User Story:** As a system administrator, I want to identify ~100 flagship news sources for priority maintenance, so that the most important feeds are always reliable and up-to-date.

#### Acceptance Criteria

1. THE System SHALL mark approximately 100 feeds as "flagship" sources using the is_featured flag
2. WHEN syncing feeds, THE System SHALL prioritize flagship feeds for more frequent updates
3. THE Flagship_Feeds SHALL include major sources from categories: Tech, News, Business, Science, Sports, Gaming, Entertainment, and Programming
4. THE System SHALL maintain all ~865 feeds while giving flagship feeds enhanced monitoring

### Requirement 2: Remove Hardcoded Mock Data from Sidebar

**User Story:** As a user, I want the left sidebar to show my actual subscribed feeds instead of hardcoded mock data, so that I can navigate to my real content.

#### Acceptance Criteria

1. THE System SHALL remove all hardcoded feed items from the sidebar component (e.g., "TechCrunch", "Ars Technica", "The Verge", "BBC News", "NPR")
2. THE System SHALL remove all hardcoded category folders with mock feeds (e.g., "Tech" folder with fake feeds)
3. THE System SHALL remove all hardcoded article counts from the sidebar

### Requirement 3: Dynamic Left Navigation

**User Story:** As a user, I want the left sidebar to show my actual subscribed feeds organized by category, so that I can quickly navigate to content from sources I care about.

#### Acceptance Criteria

1. WHEN the sidebar loads, THE System SHALL fetch the user's subscribed feeds from the /api/feeds/user endpoint
2. WHEN displaying feeds, THE System SHALL group them by category with collapsible sections
3. WHEN a user clicks on a feed in the sidebar, THE System SHALL filter the main content to show only articles from that feed
4. WHEN a user clicks on a category folder, THE System SHALL filter the main content to show articles from all feeds in that category
5. WHEN the user has no subscribed feeds, THE System SHALL display a prompt to add feeds via onboarding

### Requirement 4: Navigation State Management

**User Story:** As a user, I want the navigation to reflect my current view state, so that I know which filter is currently active.

#### Acceptance Criteria

1. WHEN a feed or category is selected, THE System SHALL visually highlight the active item
2. WHEN the user navigates to "All Articles", THE System SHALL clear any feed/category filters
3. THE System SHALL persist the sidebar collapsed/expanded state across page navigations
4. WHEN category folders are expanded/collapsed, THE System SHALL remember the state during the session

### Requirement 5: Real-time Feed Updates

**User Story:** As a user, I want the sidebar to update when I subscribe or unsubscribe from feeds, so that my navigation always reflects my current subscriptions.

#### Acceptance Criteria

1. WHEN a user subscribes to a new feed, THE System SHALL add it to the sidebar without requiring a page refresh
2. WHEN a user unsubscribes from a feed, THE System SHALL remove it from the sidebar immediately
3. THE System SHALL use TanStack Query to manage feed subscription state and enable automatic refetching
