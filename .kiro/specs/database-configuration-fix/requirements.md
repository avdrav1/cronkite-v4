# Requirements Document

## Introduction

This specification addresses the category mismatch issue that prevents the onboarding flow from loading feeds. The database contains feeds with capitalized category names (e.g., "Technology", "Business") while the frontend expects lowercase category IDs (e.g., "tech", "business"). The solution will maintain 105 feeds locally for development and 865 feeds in production, with proper category mapping for both environments.

## Glossary

- **Category_Mapping**: The system that maps between database category names and frontend category IDs
- **Frontend_Categories**: The lowercase category IDs expected by the client application (tech, business, gaming, etc.)
- **Database_Categories**: The capitalized category names stored in the database (Technology, Business, Gaming, etc.)

## Requirements

### Requirement 1

**User Story:** As a user, I want to see recommended feeds during onboarding, so that I can select feeds that match my interests.

#### Acceptance Criteria

1. WHEN a user selects interests during onboarding, THE System SHALL return feeds that match those interest categories
2. WHEN the system filters feeds by category, THE Category_Mapping SHALL correctly match Frontend_Categories to Database_Categories
3. WHEN a user selects "tech" interest, THE System SHALL return feeds with category "Technology" from the database
4. WHEN a user selects "business" interest, THE System SHALL return feeds with category "Business" from the database
5. WHEN no category mapping exists, THE System SHALL log a warning and attempt case-insensitive matching

### Requirement 2

**User Story:** As a developer, I want consistent category naming between frontend and database, so that feed filtering works correctly across the application.

#### Acceptance Criteria

1. THE System SHALL maintain a bidirectional mapping between Frontend_Categories and Database_Categories
2. WHEN storing feeds in the database, THE System SHALL use standardized category names
3. WHEN the frontend requests feeds by category, THE System SHALL translate category IDs to database category names
4. THE Category_Mapping SHALL handle both exact matches and fuzzy matching for robustness
5. THE System SHALL validate that all Frontend_Categories have corresponding Database_Categories

### Requirement 3

**User Story:** As a developer, I want the seeding scripts to use consistent category names, so that seeded data is compatible with the frontend expectations.

#### Acceptance Criteria

1. WHEN seeding the database, THE Seeding_Scripts SHALL use category names that map to Frontend_Categories
2. THE Seeding_Scripts SHALL validate category names against the Category_Mapping before insertion
3. WHEN generating feeds, THE System SHALL ensure all Frontend_Categories are represented in the seeded data
4. THE Seeding_Scripts SHALL log category distribution to verify complete coverage
5. THE System SHALL reject feeds with unmapped category names during seeding

### Requirement 4

**User Story:** As a developer, I want consistent database connectivity between seeding scripts and the application, so that seeded data is available when testing features.

#### Acceptance Criteria

1. WHEN running in development mode, THE Application SHALL connect to the same database as the seeding scripts
2. WHEN seeding scripts are executed, THE System SHALL populate the database that the application will read from
3. THE System SHALL provide clear environment configuration to control local vs remote database usage
4. WHEN database connectivity fails, THE System SHALL fall back to in-memory storage with appropriate logging

### Requirement 5

**User Story:** As a developer, I want npm scripts that handle database operations correctly, so that I can easily manage the development database with proper category mapping.

#### Acceptance Criteria

1. THE System SHALL provide npm scripts for seeding the database with correctly mapped categories
2. WHEN running seeding scripts, THE System SHALL validate category mappings before data insertion
3. THE System SHALL provide scripts to check database status, feed counts, and category distribution
4. THE System SHALL provide scripts to reset and reinitialize the development database with proper categories
5. THE Seeding_Scripts SHALL use the same Category_Mapping as the application for consistency