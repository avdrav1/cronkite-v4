import { sql } from "drizzle-orm";
import { pgTable, text, uuid, boolean, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

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
  folder_name: text("folder_name"), // Category name for sidebar grouping (copied from recommended_feeds)
  name: text("name").notNull(),
  url: text("url").notNull(),
  site_url: text("site_url"),
  description: text("description"),
  icon_url: text("icon_url"),
  icon_color: text("icon_color"),
  status: feedStatusEnum("status").notNull().default("active"),
  priority: feedPriorityEnum("priority").notNull().default("medium"),
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
  source_feeds: text("source_feeds").array().default(sql`'{}'`),
  timeframe_start: timestamp("timeframe_start", { withTimezone: true }),
  timeframe_end: timestamp("timeframe_end", { withTimezone: true }),
  expires_at: timestamp("expires_at", { withTimezone: true }),
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
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// User articles table for reading state
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
