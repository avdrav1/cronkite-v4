# Product Overview

This is **Cronkite**, an AI-powered RSS news aggregation and curation platform. The application provides users with a personalized feed of articles from various RSS sources, enhanced with AI-driven features like semantic search, trending topic clustering, and intelligent content organization.

## Core Features

### Content Aggregation & Management
- **RSS Feed Subscriptions**: Subscribe to up to 25 RSS feeds with intelligent priority-based sync scheduling
- **Smart Feed Sync**: Adaptive polling with high-priority (hourly), medium-priority (daily), and low-priority (weekly) feeds
- **Article Management**: Star articles, mark as read, track reading time, and manage engagement signals
- **Feed Organization**: Organize feeds into folders with custom icons and positions
- **Recommended Feeds**: Curated feed discovery by category, region, and language

### AI-Powered Features
- **Semantic Search**: OpenAI embeddings enable natural language article search
- **Trending Topic Clusters**: AI groups related articles from multiple sources into thematic clusters
- **Article Summaries**: On-demand AI-generated summaries using Anthropic Claude
- **Smart Clustering**: Vector similarity-based clustering with configurable thresholds
- **AI Usage Tracking**: Daily limits and cost tracking for embeddings, clustering, and summaries

### Social Features
- **Friend System**: Send and accept friend requests with mutual confirmation
- **Article Comments**: Comment on articles with friend-only visibility
- **Friend Tagging**: @mention friends in comments with autocomplete
- **Notifications**: Real-time in-app notifications for friend requests, tags, and replies
- **Privacy Controls**: Granular privacy settings for discoverability and activity sharing
- **User Blocking**: Block users to prevent all social interactions

### User Experience
- **Onboarding Flow**: Guided setup for interests, categories, and feed discovery
- **Settings Management**: Comprehensive settings for feeds, appearance, AI usage, privacy, and social preferences
- **Time Range Filtering**: View articles from last 24h, 7 days, 30 days, or all time
- **Read/Starred Filters**: Filter articles by read status and starred items
- **Responsive Design**: Masonry grid layout optimized for desktop and mobile
- **Real-time Updates**: WebSocket-powered live updates for comments, notifications, and friend status

### Technical Features
- **Supabase Authentication**: Email/password and Google OAuth support
- **PostgreSQL + pgvector**: Vector database for semantic search
- **Background Schedulers**: Automated feed sync and AI processing
- **Rate Limiting**: AI usage limits with queue management
- **Session Management**: Secure session handling with health checks
- **Admin Panel**: Admin-only features for user and feed management

## Architecture Highlights

- **Serverless-Ready**: Netlify Functions support for production deployment
- **Real-time Communication**: WebSocket service for live updates
- **Caching Layer**: Social cache service for performance optimization
- **Privacy-First**: Comprehensive privacy service with friend-only visibility
- **Modular Services**: Separate services for friends, comments, notifications, privacy, and more

## Target Audience

News enthusiasts, professionals, and anyone seeking a curated, distraction-free news reading experience with AI-powered content discovery and meaningful social engagement around current events.