import { sql } from "drizzle-orm";
import { pgTable, text, uuid, boolean, timestamp, integer, pgEnum, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Profiles table extending Supabase auth.users
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  display_name: text("display_name").notNull(),
  avatar_url: text("avatar_url"),
  timezone: text("timezone").notNull().default("America/New_York"),
  region_code: text("region_code"),
  onboarding_completed: boolean("onboarding_completed").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// User settings table with comprehensive preferences
export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  // Polling preferences
  default_polling_interval: text("default_polling_interval").notNull().default("30m"),
  adaptive_polling_enabled: boolean("adaptive_polling_enabled").notNull().default(true),
  // Digest preferences
  digest_enabled: boolean("digest_enabled").notNull().default(true),
  digest_frequency: text("digest_frequency").notNull().default("daily"),
  digest_time: text("digest_time").notNull().default("08:00"),
  digest_timezone: text("digest_timezone").notNull().default("America/New_York"),
  digest_max_articles: text("digest_max_articles").notNull().default("10"),
  // AI preferences
  ai_summaries_enabled: boolean("ai_summaries_enabled").notNull().default(true),
  ai_clustering_enabled: boolean("ai_clustering_enabled").notNull().default(true),
  ai_daily_limit: text("ai_daily_limit").notNull().default("100"),
  // Schedule preferences (feed sync timing)
  medium_priority_hour: integer("medium_priority_hour").notNull().default(9), // Hour (0-23) for medium priority feeds
  low_priority_day: integer("low_priority_day").notNull().default(5), // Day of week (0=Sun, 5=Fri) for low priority feeds
  low_priority_hour: integer("low_priority_hour").notNull().default(9), // Hour (0-23) for low priority feeds
  ai_clustering_frequency: integer("ai_clustering_frequency").notNull().default(1), // Hours between clustering (1, 4, 8, 12, 24)
  // Appearance preferences
  theme: text("theme").notNull().default("system"),
  accent_color: text("accent_color").notNull().default("blue"),
  compact_view: boolean("compact_view").notNull().default(false),
  show_images: boolean("show_images").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// User interests table for onboarding
export const userInterests = pgTable("user_interests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  selected_at: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Enum types for feeds
export const feedStatusEnum = pgEnum("feed_status", ["active", "paused", "error"]);
export const feedPriorityEnum = pgEnum("feed_priority", ["high", "medium", "low"]);

// Folders table for feed organization
export const folders = pgTable("folders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"),
  position: integer("position").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Feeds table with comprehensive metadata
export const feeds = pgTable("feeds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  folder_id: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
  folder_name: text("folder_name"), // Category name copied from recommended_feeds during subscription
  name: text("name").notNull(),
  url: text("url").notNull(),
  site_url: text("site_url"),
  description: text("description"),
  icon_url: text("icon_url"),
  icon_color: text("icon_color"),
  status: feedStatusEnum("status").notNull().default("active"),
  priority: feedPriorityEnum("priority").notNull().default("medium"),
  // AI scheduling fields (Requirements: 3.1, 3.2, 3.3, 3.4)
  sync_priority: text("sync_priority").notNull().default("medium"), // 'high', 'medium', 'low'
  next_sync_at: timestamp("next_sync_at", { withTimezone: true }),
  sync_interval_hours: integer("sync_interval_hours").notNull().default(24),
  custom_polling_interval: integer("custom_polling_interval"), // in minutes
  last_fetched_at: timestamp("last_fetched_at", { withTimezone: true }),
  etag: text("etag"),
  last_modified: text("last_modified"),
  article_count: integer("article_count").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Recommended feeds table for discovery
export const recommendedFeeds = pgTable("recommended_feeds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  site_url: text("site_url"),
  description: text("description"),
  icon_url: text("icon_url"),
  category: text("category").notNull(),
  country: text("country"),
  language: text("language").notNull().default("en"),
  tags: text("tags").array().default(sql`'{}'`),
  popularity_score: integer("popularity_score").notNull().default(0),
  article_frequency: text("article_frequency"), // e.g., 'daily', 'hourly', 'weekly'
  is_featured: boolean("is_featured").notNull().default(false),
  // AI priority field (Requirements: 3.7, 6.6)
  default_priority: text("default_priority").notNull().default("medium"), // 'high', 'medium', 'low'
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Feed sync log table for tracking synchronization
export const feedSyncLog = pgTable("feed_sync_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  feed_id: uuid("feed_id").notNull().references(() => feeds.id, { onDelete: "cascade" }),
  sync_started_at: timestamp("sync_started_at", { withTimezone: true }).notNull().defaultNow(),
  sync_completed_at: timestamp("sync_completed_at", { withTimezone: true }),
  sync_duration_ms: integer("sync_duration_ms"),
  status: text("status").notNull().default("in_progress"), // 'success', 'error', 'in_progress'
  http_status_code: integer("http_status_code"),
  error_message: text("error_message"),
  articles_found: integer("articles_found").default(0),
  articles_new: integer("articles_new").default(0),
  articles_updated: integer("articles_updated").default(0),
  etag_received: text("etag_received"),
  last_modified_received: text("last_modified_received"),
  feed_size_bytes: integer("feed_size_bytes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Clusters table for AI topic grouping
export const clusters = pgTable("clusters", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary"),
  article_count: integer("article_count").notNull().default(0),
  article_ids: text("article_ids").array().default(sql`'{}'`), // Store article IDs directly
  source_feeds: text("source_feeds").array().default(sql`'{}'`),
  timeframe_start: timestamp("timeframe_start", { withTimezone: true }),
  timeframe_end: timestamp("timeframe_end", { withTimezone: true }),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  // Vector-based clustering fields (Requirements: 2.1, 2.7)
  avg_similarity: text("avg_similarity"), // Store as text, convert to float in application
  relevance_score: text("relevance_score"), // article_count × source_diversity
  generation_method: text("generation_method").default("vector"), // 'vector' or 'keyword'
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Articles table with AI enhancement fields
export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  feed_id: uuid("feed_id").notNull().references(() => feeds.id, { onDelete: "cascade" }),
  guid: text("guid").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  author: text("author"),
  excerpt: text("excerpt"),
  content: text("content"),
  image_url: text("image_url"),
  published_at: timestamp("published_at", { withTimezone: true }),
  fetched_at: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  ai_summary: text("ai_summary"),
  ai_summary_generated_at: timestamp("ai_summary_generated_at", { withTimezone: true }),
  embedding: text("embedding"), // Store as text for now, will be vector in production
  cluster_id: uuid("cluster_id").references(() => clusters.id, { onDelete: "set null" }),
  // Embedding tracking fields (Requirements: 1.4, 7.3)
  embedding_status: text("embedding_status").notNull().default("pending"), // 'pending', 'completed', 'failed', 'skipped'
  embedding_generated_at: timestamp("embedding_generated_at", { withTimezone: true }),
  embedding_error: text("embedding_error"),
  content_hash: text("content_hash"), // For change detection (Requirements: 1.5)
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// User articles table for reading state and engagement signals
export const userArticles = pgTable("user_articles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  article_id: uuid("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  is_read: boolean("is_read").notNull().default(false),
  read_at: timestamp("read_at", { withTimezone: true }),
  is_starred: boolean("is_starred").notNull().default(false),
  starred_at: timestamp("starred_at", { withTimezone: true }),
  clicked_at: timestamp("clicked_at", { withTimezone: true }),
  time_spent_seconds: integer("time_spent_seconds"),
  // Engagement signals for content recommendations (Requirements: 8.1, 8.2, 8.3, 8.4)
  engagement_signal: text("engagement_signal"), // 'positive' | 'negative' | null
  engagement_signal_at: timestamp("engagement_signal_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Embedding queue table for managing embedding generation (Requirements: 1.2, 7.1)
export const embeddingQueue = pgTable("embedding_queue", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  article_id: uuid("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  max_attempts: integer("max_attempts").notNull().default(3),
  last_attempt_at: timestamp("last_attempt_at", { withTimezone: true }),
  error_message: text("error_message"),
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'dead_letter'
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// AI usage log table for detailed API call tracking (Requirements: 8.1, 8.5)
export const aiUsageLog = pgTable("ai_usage_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  operation: text("operation").notNull(), // 'embedding', 'clustering', 'search', 'summary'
  provider: text("provider").notNull(), // 'openai', 'anthropic'
  model: text("model"),
  token_count: integer("token_count").notNull().default(0),
  input_tokens: integer("input_tokens"),
  output_tokens: integer("output_tokens"),
  estimated_cost: decimal("estimated_cost", { precision: 10, scale: 6 }).notNull().default("0"),
  request_metadata: text("request_metadata"), // JSON string
  success: boolean("success").notNull().default(true),
  error_message: text("error_message"),
  latency_ms: integer("latency_ms"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// AI daily usage summary table (Requirements: 8.2, 8.3, 8.4, 8.6)
export const aiUsageDaily = pgTable("ai_usage_daily", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD format
  embeddings_count: integer("embeddings_count").notNull().default(0),
  clusterings_count: integer("clusterings_count").notNull().default(0),
  searches_count: integer("searches_count").notNull().default(0),
  summaries_count: integer("summaries_count").notNull().default(0),
  total_tokens: integer("total_tokens").notNull().default(0),
  openai_tokens: integer("openai_tokens").notNull().default(0),
  anthropic_tokens: integer("anthropic_tokens").notNull().default(0),
  estimated_cost: decimal("estimated_cost", { precision: 10, scale: 6 }).notNull().default("0"),
  // Daily limits (configurable per user)
  embeddings_limit: integer("embeddings_limit").notNull().default(500),
  clusterings_limit: integer("clusterings_limit").notNull().default(10),
  searches_limit: integer("searches_limit").notNull().default(100),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Zod schemas for validation
export const insertProfileSchema = createInsertSchema(profiles);
export const selectProfileSchema = createSelectSchema(profiles);

export const insertUserSettingsSchema = createInsertSchema(userSettings);
export const selectUserSettingsSchema = createSelectSchema(userSettings);

export const insertUserInterestsSchema = createInsertSchema(userInterests);
export const selectUserInterestsSchema = createSelectSchema(userInterests);

export const insertFolderSchema = createInsertSchema(folders);
export const selectFolderSchema = createSelectSchema(folders);

export const insertFeedSchema = createInsertSchema(feeds);
export const selectFeedSchema = createSelectSchema(feeds);

export const insertRecommendedFeedSchema = createInsertSchema(recommendedFeeds);
export const selectRecommendedFeedSchema = createSelectSchema(recommendedFeeds);

export const insertFeedSyncLogSchema = createInsertSchema(feedSyncLog);
export const selectFeedSyncLogSchema = createSelectSchema(feedSyncLog);

export const insertClusterSchema = createInsertSchema(clusters);
export const selectClusterSchema = createSelectSchema(clusters);

export const insertArticleSchema = createInsertSchema(articles);
export const selectArticleSchema = createSelectSchema(articles);

export const insertUserArticleSchema = createInsertSchema(userArticles);
export const selectUserArticleSchema = createSelectSchema(userArticles);

export const insertEmbeddingQueueSchema = createInsertSchema(embeddingQueue);
export const selectEmbeddingQueueSchema = createSelectSchema(embeddingQueue);

export const insertAiUsageLogSchema = createInsertSchema(aiUsageLog);
export const selectAiUsageLogSchema = createSelectSchema(aiUsageLog);

export const insertAiUsageDailySchema = createInsertSchema(aiUsageDaily);
export const selectAiUsageDailySchema = createSelectSchema(aiUsageDaily);

// Feed management constants (Requirements: 3.1)
export const MAX_FEEDS_PER_USER = 25;
export const FEED_LIMIT_WARNING_THRESHOLD = 20;

// Engagement signal type for type safety
export type EngagementSignal = 'positive' | 'negative' | null;

// Type exports
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;
export type UserInterests = typeof userInterests.$inferSelect;
export type InsertUserInterests = typeof userInterests.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type InsertFolder = typeof folders.$inferInsert;
export type Feed = typeof feeds.$inferSelect;
export type InsertFeed = typeof feeds.$inferInsert;
export type RecommendedFeed = typeof recommendedFeeds.$inferSelect;
export type InsertRecommendedFeed = typeof recommendedFeeds.$inferInsert;
export type FeedSyncLog = typeof feedSyncLog.$inferSelect;
export type InsertFeedSyncLog = typeof feedSyncLog.$inferInsert;
export type Cluster = typeof clusters.$inferSelect;
export type InsertCluster = typeof clusters.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;
export type UserArticle = typeof userArticles.$inferSelect;
export type InsertUserArticle = typeof userArticles.$inferInsert;

// Embedding queue types (Requirements: 1.2, 7.1)
export type EmbeddingQueue = typeof embeddingQueue.$inferSelect;
export type InsertEmbeddingQueue = typeof embeddingQueue.$inferInsert;

// AI usage log types (Requirements: 8.1, 8.5)
export type AIUsageLog = typeof aiUsageLog.$inferSelect;
export type InsertAIUsageLog = typeof aiUsageLog.$inferInsert;

// AI daily usage types (Requirements: 8.2, 8.3, 8.4, 8.6)
export type AIUsageDaily = typeof aiUsageDaily.$inferSelect;
export type InsertAIUsageDaily = typeof aiUsageDaily.$inferInsert;

// Feed priority type for type safety (Requirements: 3.1, 3.2, 3.3)
export type FeedPriority = 'high' | 'medium' | 'low';

// Embedding status type for type safety (Requirements: 7.3)
export type EmbeddingStatus = 'pending' | 'completed' | 'failed' | 'skipped';

// AI operation type for type safety (Requirements: 8.1)
export type AIOperation = 'embedding' | 'clustering' | 'search' | 'summary';

// AI provider type for type safety
export type AIProvider = 'openai' | 'anthropic';

// Priority intervals in hours (Requirements: 3.1, 3.2, 3.3)
export const PRIORITY_INTERVALS: Record<FeedPriority, number> = {
  high: 1,      // Every hour
  medium: 24,   // Every day
  low: 168      // Every week (7 * 24)
};

// Default high-priority sources (breaking news) (Requirements: 3.7)
export const HIGH_PRIORITY_SOURCES = [
  'nytimes.com',
  'bbc.com',
  'bbc.co.uk',
  'cnn.com',
  'reuters.com',
  'apnews.com',
  'washingtonpost.com',
  'theguardian.com'
];

// AI usage limits (Requirements: 8.2, 8.3)
export const DEFAULT_AI_LIMITS = {
  embeddingsPerDay: 500,
  clusteringsPerDay: 10,
  searchesPerDay: 100
};

// Dead letter queue table for permanently failed operations (Requirements: 9.4)
export const deadLetterQueue = pgTable("dead_letter_queue", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  operation: text("operation").notNull(), // 'embedding', 'clustering', 'search', 'summary'
  provider: text("provider").notNull(), // 'openai', 'anthropic'
  user_id: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
  payload: text("payload").notNull(), // JSON string
  error_message: text("error_message").notNull(),
  attempts: integer("attempts").notNull().default(0),
  last_attempt_at: timestamp("last_attempt_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Request queue table for rate-limited requests (Requirements: 8.4)
export const requestQueue = pgTable("request_queue", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  operation: text("operation").notNull(), // 'embedding', 'clustering', 'search', 'summary'
  provider: text("provider").notNull(), // 'openai', 'anthropic'
  payload: text("payload").notNull(), // JSON string
  priority: integer("priority").notNull().default(0),
  scheduled_for: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Zod schemas for new tables
export const insertDeadLetterQueueSchema = createInsertSchema(deadLetterQueue);
export const selectDeadLetterQueueSchema = createSelectSchema(deadLetterQueue);

export const insertRequestQueueSchema = createInsertSchema(requestQueue);
export const selectRequestQueueSchema = createSelectSchema(requestQueue);

// Dead letter queue types (Requirements: 9.4)
export type DeadLetterQueue = typeof deadLetterQueue.$inferSelect;
export type InsertDeadLetterQueue = typeof deadLetterQueue.$inferInsert;

// Request queue types (Requirements: 8.4)
export type RequestQueue = typeof requestQueue.$inferSelect;
export type InsertRequestQueue = typeof requestQueue.$inferInsert;

