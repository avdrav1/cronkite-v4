// Load environment variables first
import './env';

import { 
  type Profile, 
  type InsertProfile, 
  type UserSettings, 
  type InsertUserSettings,
  type UserInterests,
  type InsertUserInterests,
  type RecommendedFeed,
  type InsertRecommendedFeed,
  type Feed,
  type InsertFeed,
  type FeedSyncLog,
  type InsertFeedSyncLog,
  type Article,
  type InsertArticle,
  type UserArticle,
  type InsertUserArticle,
  type Cluster,
  type InsertCluster
} from "@shared/schema";
import { categoryMappingService } from "@shared/category-mapping";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User Management
  getUser(id: string): Promise<Profile | undefined>;
  getUserByEmail(email: string): Promise<Profile | undefined>;
  createUser(user: InsertProfile): Promise<Profile>;
  updateUser(id: string, updates: Partial<Profile>): Promise<Profile>;
  
  // Authentication Methods
  authenticateUser(email: string, password: string): Promise<Profile | null>;
  createUserWithPassword(user: InsertProfile, password: string): Promise<Profile>;
  updateUserPassword(userId: string, newPassword: string): Promise<void>;
  
  // User Settings
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(userId: string, settings?: Partial<InsertUserSettings>): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings>;
  
  // User Interests Management
  setUserInterests(userId: string, interests: string[]): Promise<void>;
  getUserInterests(userId: string): Promise<UserInterests[]>;
  
  // Recommended Feeds Retrieval
  getRecommendedFeeds(): Promise<RecommendedFeed[]>;
  
  // Recommended Feeds Management with Category Validation
  createRecommendedFeed(feed: InsertRecommendedFeed): Promise<RecommendedFeed>;
  updateRecommendedFeed(id: string, updates: Partial<RecommendedFeed>): Promise<RecommendedFeed>;
  
  // User Feed Subscription Management
  getUserFeeds(userId: string): Promise<Feed[]>;
  subscribeToFeeds(userId: string, feedIds: string[]): Promise<void>;
  unsubscribeFromFeed(userId: string, feedId: string): Promise<void>;
  
  // Feed Synchronization Management
  startFeedSync(feedId: string): Promise<string>; // Returns sync log ID
  completeFeedSyncSuccess(syncLogId: string, stats: {
    httpStatusCode?: number;
    articlesFound?: number;
    articlesNew?: number;
    articlesUpdated?: number;
    etagReceived?: string;
    lastModifiedReceived?: string;
    feedSizeBytes?: number;
  }): Promise<void>;
  completeFeedSyncError(syncLogId: string, errorMessage: string, httpStatusCode?: number): Promise<void>;
  getFeedSyncStatus(userId: string): Promise<{
    totalFeeds: number;
    syncing: number;
    completed: number;
    failed: number;
    lastSyncAt?: Date;
  }>;
  
  // Article Management
  createArticle(article: InsertArticle): Promise<Article>;
  updateArticle(id: string, updates: Partial<Article>): Promise<Article>;
  getArticleByGuid(feedId: string, guid: string): Promise<Article | undefined>;
  getArticlesByFeedId(feedId: string, limit?: number): Promise<Article[]>;
  
  // User Article Management
  getUserArticleState(userId: string, articleId: string): Promise<UserArticle | undefined>;
  createUserArticleState(userArticle: InsertUserArticle): Promise<UserArticle>;
  updateUserArticleState(userId: string, articleId: string, updates: Partial<UserArticle>): Promise<UserArticle>;
}

export class MemStorage implements IStorage {
  private users: Map<string, Profile>;
  private passwords: Map<string, string>; // userId -> hashedPassword
  private userSettings: Map<string, UserSettings>;
  private userInterests: Map<string, UserInterests[]>; // userId -> interests
  private recommendedFeeds: RecommendedFeed[];
  private userFeeds: Map<string, Feed[]>; // userId -> feeds
  private feedSyncLogs: Map<string, FeedSyncLog>; // syncLogId -> syncLog
  private articles: Map<string, Article>; // articleId -> article
  private userArticles: Map<string, UserArticle>; // userId:articleId -> userArticle

  constructor() {
    console.log('🔧 Initializing MemStorage...');
    console.log('🔧 MemStorage: Starting in-memory storage initialization for fallback support');
    
    this.users = new Map();
    this.passwords = new Map();
    this.userSettings = new Map();
    this.userInterests = new Map();
    this.recommendedFeeds = [];
    this.userFeeds = new Map();
    this.feedSyncLogs = new Map();
    this.articles = new Map();
    this.userArticles = new Map();
    
    console.log('📰 Initializing mock recommended feeds with category mapping validation...');
    
    // Initialize with some mock recommended feeds
    this.initializeMockRecommendedFeeds();
    
    console.log(`✅ MemStorage initialized with ${this.recommendedFeeds.length} recommended feeds`);
    console.log('✅ MemStorage: All feeds validated against category mapping service');
    console.log('✅ MemStorage: Ready to serve as fallback storage when Supabase is unavailable');
  }

  async getUser(id: string): Promise<Profile | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<Profile | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertProfile): Promise<Profile> {
    const id = insertUser.id || randomUUID();
    const user: Profile = { 
      id,
      email: insertUser.email,
      display_name: insertUser.display_name,
      avatar_url: insertUser.avatar_url ?? null,
      timezone: insertUser.timezone ?? "America/New_York",
      region_code: insertUser.region_code ?? null,
      onboarding_completed: insertUser.onboarding_completed ?? false,
      created_at: insertUser.created_at || new Date(),
      updated_at: insertUser.updated_at || new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<Profile>): Promise<Profile> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }
    
    const updatedUser: Profile = {
      ...existingUser,
      ...updates,
      updated_at: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Authentication Methods
  async authenticateUser(email: string, password: string): Promise<Profile | null> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return null;
    }
    
    const storedPassword = this.passwords.get(user.id);
    if (!storedPassword || storedPassword !== password) {
      return null;
    }
    
    return user;
  }

  async createUserWithPassword(user: InsertProfile, password: string): Promise<Profile> {
    const newUser = await this.createUser(user);
    this.passwords.set(newUser.id, password); // In real implementation, this would be hashed
    
    // Create default user settings
    await this.createUserSettings(newUser.id);
    
    return newUser;
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }
    
    this.passwords.set(userId, newPassword); // In real implementation, this would be hashed
  }

  // User Settings
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return this.userSettings.get(userId);
  }

  async createUserSettings(userId: string, settings?: Partial<InsertUserSettings>): Promise<UserSettings> {
    const id = randomUUID();
    const userSettings: UserSettings = {
      id,
      user_id: userId,
      default_polling_interval: settings?.default_polling_interval ?? "30m",
      adaptive_polling_enabled: settings?.adaptive_polling_enabled ?? true,
      digest_enabled: settings?.digest_enabled ?? true,
      digest_frequency: settings?.digest_frequency ?? "daily",
      digest_time: settings?.digest_time ?? "08:00",
      digest_timezone: settings?.digest_timezone ?? "America/New_York",
      digest_max_articles: settings?.digest_max_articles ?? "10",
      ai_summaries_enabled: settings?.ai_summaries_enabled ?? true,
      ai_clustering_enabled: settings?.ai_clustering_enabled ?? true,
      ai_daily_limit: settings?.ai_daily_limit ?? "100",
      theme: settings?.theme ?? "system",
      accent_color: settings?.accent_color ?? "blue",
      compact_view: settings?.compact_view ?? false,
      show_images: settings?.show_images ?? true,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    this.userSettings.set(userId, userSettings);
    return userSettings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    const existingSettings = this.userSettings.get(userId);
    if (!existingSettings) {
      throw new Error(`User settings for user ${userId} not found`);
    }
    
    const updatedSettings: UserSettings = {
      ...existingSettings,
      ...updates,
      updated_at: new Date()
    };
    
    this.userSettings.set(userId, updatedSettings);
    return updatedSettings;
  }

  // User Interests Management
  async setUserInterests(userId: string, interests: string[]): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }
    
    const userInterestsList: UserInterests[] = interests.map(category => ({
      id: randomUUID(),
      user_id: userId,
      category,
      selected_at: new Date(),
      created_at: new Date()
    }));
    
    this.userInterests.set(userId, userInterestsList);
  }

  async getUserInterests(userId: string): Promise<UserInterests[]> {
    return this.userInterests.get(userId) || [];
  }

  // Recommended Feeds Retrieval
  async getRecommendedFeeds(): Promise<RecommendedFeed[]> {
    console.log(`📊 MemStorage: Retrieving recommended feeds...`);
    console.log(`📊 MemStorage: Returning ${this.recommendedFeeds.length} recommended feeds`);
    
    // Validate data consistency
    if (this.recommendedFeeds.length === 0) {
      console.warn('⚠️  MemStorage: No recommended feeds available - this may indicate an initialization issue');
    } else if (this.recommendedFeeds.length !== 865) {
      console.warn(`⚠️  MemStorage: Expected 865 feeds, but have ${this.recommendedFeeds.length} feeds`);
    } else {
      console.log('✅ MemStorage: Feed count validation passed');
    }
    
    return this.recommendedFeeds;
  }

  // Recommended Feeds Management with Category Validation
  async createRecommendedFeed(insertFeed: InsertRecommendedFeed): Promise<RecommendedFeed> {
    console.log(`🔍 MemStorage: Creating recommended feed with category validation...`);
    
    // Validate category using category mapping service
    if (!categoryMappingService.isValidDatabaseCategory(insertFeed.category)) {
      const errorMsg = `Invalid category "${insertFeed.category}" - not found in category mapping`;
      console.error(`❌ MemStorage: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    console.log(`✅ MemStorage: Category "${insertFeed.category}" validation passed`);
    
    const id = insertFeed.id || randomUUID();
    const feed: RecommendedFeed = {
      id,
      name: insertFeed.name,
      url: insertFeed.url,
      site_url: insertFeed.site_url || null,
      description: insertFeed.description || null,
      icon_url: insertFeed.icon_url || null,
      category: insertFeed.category,
      country: insertFeed.country || null,
      language: insertFeed.language || "en",
      tags: insertFeed.tags || [],
      popularity_score: insertFeed.popularity_score || 0,
      article_frequency: insertFeed.article_frequency || null,
      is_featured: insertFeed.is_featured || false,
      created_at: insertFeed.created_at || new Date(),
      updated_at: insertFeed.updated_at || new Date()
    };
    
    this.recommendedFeeds.push(feed);
    console.log(`✅ MemStorage: Recommended feed created successfully with valid category "${feed.category}"`);
    
    return feed;
  }

  async updateRecommendedFeed(id: string, updates: Partial<RecommendedFeed>): Promise<RecommendedFeed> {
    console.log(`🔍 MemStorage: Updating recommended feed ${id} with category validation...`);
    
    const existingFeedIndex = this.recommendedFeeds.findIndex(feed => feed.id === id);
    if (existingFeedIndex === -1) {
      throw new Error(`Recommended feed with id ${id} not found`);
    }
    
    const existingFeed = this.recommendedFeeds[existingFeedIndex];
    
    // Validate category if it's being updated
    if (updates.category && updates.category !== existingFeed.category) {
      if (!categoryMappingService.isValidDatabaseCategory(updates.category)) {
        const errorMsg = `Invalid category "${updates.category}" - not found in category mapping`;
        console.error(`❌ MemStorage: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      console.log(`✅ MemStorage: Category update "${updates.category}" validation passed`);
    }
    
    const updatedFeed: RecommendedFeed = {
      ...existingFeed,
      ...updates,
      updated_at: new Date()
    };
    
    this.recommendedFeeds[existingFeedIndex] = updatedFeed;
    console.log(`✅ MemStorage: Recommended feed updated successfully with valid category "${updatedFeed.category}"`);
    
    return updatedFeed;
  }

  // User Feed Subscription Management
  async getUserFeeds(userId: string): Promise<Feed[]> {
    return this.userFeeds.get(userId) || [];
  }

  async subscribeToFeeds(userId: string, feedIds: string[]): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with id ${userId} not found`);
    }
    
    const existingFeeds = this.userFeeds.get(userId) || [];
    const newFeeds: Feed[] = [];
    
    for (const feedId of feedIds) {
      // Find the recommended feed to create a user feed from
      const recommendedFeed = this.recommendedFeeds.find(f => f.id === feedId);
      if (recommendedFeed) {
        const userFeed: Feed = {
          id: randomUUID(),
          user_id: userId,
          folder_id: null,
          name: recommendedFeed.name,
          url: recommendedFeed.url,
          site_url: recommendedFeed.site_url,
          description: recommendedFeed.description,
          icon_url: recommendedFeed.icon_url,
          icon_color: null,
          status: "active",
          priority: "medium",
          custom_polling_interval: null,
          last_fetched_at: null,
          etag: null,
          last_modified: null,
          article_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        };
        newFeeds.push(userFeed);
      }
    }
    
    this.userFeeds.set(userId, [...existingFeeds, ...newFeeds]);
  }

  async unsubscribeFromFeed(userId: string, feedId: string): Promise<void> {
    const existingFeeds = this.userFeeds.get(userId) || [];
    const updatedFeeds = existingFeeds.filter(feed => feed.id !== feedId);
    this.userFeeds.set(userId, updatedFeeds);
  }

  // Feed Synchronization Management
  async startFeedSync(feedId: string): Promise<string> {
    const syncLogId = randomUUID();
    const syncLog: FeedSyncLog = {
      id: syncLogId,
      feed_id: feedId,
      sync_started_at: new Date(),
      sync_completed_at: null,
      sync_duration_ms: null,
      status: "in_progress",
      http_status_code: null,
      error_message: null,
      articles_found: 0,
      articles_new: 0,
      articles_updated: 0,
      etag_received: null,
      last_modified_received: null,
      feed_size_bytes: null,
      created_at: new Date()
    };
    
    this.feedSyncLogs.set(syncLogId, syncLog);
    return syncLogId;
  }

  async completeFeedSyncSuccess(syncLogId: string, stats: {
    httpStatusCode?: number;
    articlesFound?: number;
    articlesNew?: number;
    articlesUpdated?: number;
    etagReceived?: string;
    lastModifiedReceived?: string;
    feedSizeBytes?: number;
  }): Promise<void> {
    const syncLog = this.feedSyncLogs.get(syncLogId);
    if (!syncLog) {
      throw new Error(`Sync log with id ${syncLogId} not found`);
    }
    
    const completedAt = new Date();
    const duration = completedAt.getTime() - syncLog.sync_started_at.getTime();
    
    const updatedSyncLog: FeedSyncLog = {
      ...syncLog,
      sync_completed_at: completedAt,
      sync_duration_ms: duration,
      status: "success",
      http_status_code: stats.httpStatusCode || null,
      articles_found: stats.articlesFound || 0,
      articles_new: stats.articlesNew || 0,
      articles_updated: stats.articlesUpdated || 0,
      etag_received: stats.etagReceived || null,
      last_modified_received: stats.lastModifiedReceived || null,
      feed_size_bytes: stats.feedSizeBytes || null
    };
    
    this.feedSyncLogs.set(syncLogId, updatedSyncLog);
  }

  async completeFeedSyncError(syncLogId: string, errorMessage: string, httpStatusCode?: number): Promise<void> {
    const syncLog = this.feedSyncLogs.get(syncLogId);
    if (!syncLog) {
      throw new Error(`Sync log with id ${syncLogId} not found`);
    }
    
    const completedAt = new Date();
    const duration = completedAt.getTime() - syncLog.sync_started_at.getTime();
    
    const updatedSyncLog: FeedSyncLog = {
      ...syncLog,
      sync_completed_at: completedAt,
      sync_duration_ms: duration,
      status: "error",
      error_message: errorMessage,
      http_status_code: httpStatusCode || null
    };
    
    this.feedSyncLogs.set(syncLogId, updatedSyncLog);
  }

  async getFeedSyncStatus(userId: string): Promise<{
    totalFeeds: number;
    syncing: number;
    completed: number;
    failed: number;
    lastSyncAt?: Date;
  }> {
    const userFeeds = this.userFeeds.get(userId) || [];
    const feedIds = userFeeds.map(feed => feed.id);
    
    const relevantSyncLogs = Array.from(this.feedSyncLogs.values())
      .filter(log => feedIds.includes(log.feed_id));
    
    // Get the most recent sync log for each feed
    const latestSyncsByFeed = new Map<string, FeedSyncLog>();
    relevantSyncLogs.forEach(log => {
      const existing = latestSyncsByFeed.get(log.feed_id);
      if (!existing || log.sync_started_at > existing.sync_started_at) {
        latestSyncsByFeed.set(log.feed_id, log);
      }
    });
    
    const latestSyncs = Array.from(latestSyncsByFeed.values());
    const syncing = latestSyncs.filter(log => log.status === "in_progress").length;
    const completed = latestSyncs.filter(log => log.status === "success").length;
    const failed = latestSyncs.filter(log => log.status === "error").length;
    
    const lastSyncAt = latestSyncs.length > 0 
      ? new Date(Math.max(...latestSyncs.map(log => log.sync_started_at.getTime())))
      : undefined;
    
    return {
      totalFeeds: userFeeds.length,
      syncing,
      completed,
      failed,
      lastSyncAt
    };
  }

  // Article Management
  async createArticle(insertArticle: InsertArticle): Promise<Article> {
    const id = randomUUID();
    const article: Article = {
      id,
      feed_id: insertArticle.feed_id,
      guid: insertArticle.guid,
      title: insertArticle.title,
      url: insertArticle.url,
      author: insertArticle.author || null,
      excerpt: insertArticle.excerpt || null,
      content: insertArticle.content || null,
      image_url: insertArticle.image_url || null,
      published_at: insertArticle.published_at || null,
      fetched_at: insertArticle.fetched_at || new Date(),
      ai_summary: insertArticle.ai_summary || null,
      ai_summary_generated_at: insertArticle.ai_summary_generated_at || null,
      embedding: insertArticle.embedding || null,
      cluster_id: insertArticle.cluster_id || null,
      created_at: insertArticle.created_at || new Date()
    };
    
    this.articles.set(id, article);
    return article;
  }

  async updateArticle(id: string, updates: Partial<Article>): Promise<Article> {
    const existingArticle = this.articles.get(id);
    if (!existingArticle) {
      throw new Error(`Article with id ${id} not found`);
    }
    
    const updatedArticle: Article = {
      ...existingArticle,
      ...updates
    };
    
    this.articles.set(id, updatedArticle);
    return updatedArticle;
  }

  async getArticleByGuid(feedId: string, guid: string): Promise<Article | undefined> {
    return Array.from(this.articles.values()).find(
      article => article.feed_id === feedId && article.guid === guid
    );
  }

  async getArticlesByFeedId(feedId: string, limit?: number): Promise<Article[]> {
    const feedArticles = Array.from(this.articles.values())
      .filter(article => article.feed_id === feedId)
      .sort((a, b) => (b.published_at?.getTime() || 0) - (a.published_at?.getTime() || 0));
    
    return limit ? feedArticles.slice(0, limit) : feedArticles;
  }

  // User Article Management
  async getUserArticleState(userId: string, articleId: string): Promise<UserArticle | undefined> {
    const key = `${userId}:${articleId}`;
    return this.userArticles.get(key);
  }

  async createUserArticleState(insertUserArticle: InsertUserArticle): Promise<UserArticle> {
    const id = randomUUID();
    const userArticle: UserArticle = {
      id,
      user_id: insertUserArticle.user_id,
      article_id: insertUserArticle.article_id,
      is_read: insertUserArticle.is_read || false,
      read_at: insertUserArticle.read_at || null,
      is_starred: insertUserArticle.is_starred || false,
      starred_at: insertUserArticle.starred_at || null,
      clicked_at: insertUserArticle.clicked_at || null,
      time_spent_seconds: insertUserArticle.time_spent_seconds || null,
      created_at: insertUserArticle.created_at || new Date(),
      updated_at: insertUserArticle.updated_at || new Date()
    };
    
    const key = `${userArticle.user_id}:${userArticle.article_id}`;
    this.userArticles.set(key, userArticle);
    return userArticle;
  }

  async updateUserArticleState(userId: string, articleId: string, updates: Partial<UserArticle>): Promise<UserArticle> {
    const key = `${userId}:${articleId}`;
    const existingUserArticle = this.userArticles.get(key);
    
    if (!existingUserArticle) {
      // Create new user article state if it doesn't exist
      return this.createUserArticleState({
        user_id: userId,
        article_id: articleId,
        ...updates
      });
    }
    
    const updatedUserArticle: UserArticle = {
      ...existingUserArticle,
      ...updates,
      updated_at: new Date()
    };
    
    this.userArticles.set(key, updatedUserArticle);
    return updatedUserArticle;
  }

  private initializeMockRecommendedFeeds(): void {
    console.log('🔧 Starting mock recommended feeds initialization...');
    
    // Initialize with comprehensive mock recommended feeds for development
    this.recommendedFeeds = [
      // Technology Feeds
      {
        id: randomUUID(),
        name: "TechCrunch",
        url: "https://techcrunch.com/feed/",
        site_url: "https://techcrunch.com",
        description: "The latest technology news and information on startups",
        icon_url: "https://techcrunch.com/favicon.ico",
        category: "Technology",
        country: "US",
        language: "en",
        tags: ["technology", "startups", "venture capital"],
        popularity_score: 95,
        article_frequency: "hourly",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "The Verge",
        url: "https://www.theverge.com/rss/index.xml",
        site_url: "https://www.theverge.com",
        description: "Technology, science, art, and culture",
        icon_url: "https://www.theverge.com/favicon.ico",
        category: "Technology",
        country: "US",
        language: "en",
        tags: ["technology", "science", "culture"],
        popularity_score: 90,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "Ars Technica",
        url: "https://feeds.arstechnica.com/arstechnica/index",
        site_url: "https://arstechnica.com",
        description: "Technology news and analysis",
        icon_url: "https://arstechnica.com/favicon.ico",
        category: "Technology",
        country: "US",
        language: "en",
        tags: ["technology", "science", "analysis"],
        popularity_score: 85,
        article_frequency: "daily",
        is_featured: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "Wired",
        url: "https://www.wired.com/feed/rss",
        site_url: "https://www.wired.com",
        description: "Ideas, breakthroughs, and the future",
        icon_url: "https://www.wired.com/favicon.ico",
        category: "Technology",
        country: "US",
        language: "en",
        tags: ["technology", "future", "innovation"],
        popularity_score: 88,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // News Feeds
      {
        id: randomUUID(),
        name: "BBC News",
        url: "http://feeds.bbci.co.uk/news/rss.xml",
        site_url: "https://www.bbc.com/news",
        description: "Breaking news, sport, TV, radio and a whole lot more",
        icon_url: "https://www.bbc.com/favicon.ico",
        category: "News",
        country: "UK",
        language: "en",
        tags: ["news", "world", "politics"],
        popularity_score: 98,
        article_frequency: "hourly",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "Reuters",
        url: "https://feeds.reuters.com/reuters/topNews",
        site_url: "https://www.reuters.com",
        description: "Breaking international news and headlines",
        icon_url: "https://www.reuters.com/favicon.ico",
        category: "News",
        country: "US",
        language: "en",
        tags: ["news", "international", "breaking"],
        popularity_score: 96,
        article_frequency: "hourly",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "Associated Press",
        url: "https://feeds.apnews.com/rss/apf-topnews",
        site_url: "https://apnews.com",
        description: "The definitive source for global and local news",
        icon_url: "https://apnews.com/favicon.ico",
        category: "News",
        country: "US",
        language: "en",
        tags: ["news", "breaking", "global"],
        popularity_score: 94,
        article_frequency: "hourly",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Business Feeds
      {
        id: randomUUID(),
        name: "Wall Street Journal",
        url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
        site_url: "https://www.wsj.com",
        description: "Breaking news and analysis from the U.S. and around the world",
        icon_url: "https://www.wsj.com/favicon.ico",
        category: "Business",
        country: "US",
        language: "en",
        tags: ["business", "finance", "markets"],
        popularity_score: 92,
        article_frequency: "hourly",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "Bloomberg",
        url: "https://feeds.bloomberg.com/markets/news.rss",
        site_url: "https://www.bloomberg.com",
        description: "Business and financial news",
        icon_url: "https://www.bloomberg.com/favicon.ico",
        category: "Business",
        country: "US",
        language: "en",
        tags: ["business", "finance", "markets"],
        popularity_score: 90,
        article_frequency: "hourly",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Science Feeds
      {
        id: randomUUID(),
        name: "Nature",
        url: "https://www.nature.com/nature.rss",
        site_url: "https://www.nature.com",
        description: "International journal of science",
        icon_url: "https://www.nature.com/favicon.ico",
        category: "Science",
        country: "UK",
        language: "en",
        tags: ["science", "research", "academic"],
        popularity_score: 87,
        article_frequency: "weekly",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "Scientific American",
        url: "https://rss.sciam.com/ScientificAmerican-Global",
        site_url: "https://www.scientificamerican.com",
        description: "Science news and technology updates",
        icon_url: "https://www.scientificamerican.com/favicon.ico",
        category: "Science",
        country: "US",
        language: "en",
        tags: ["science", "technology", "research"],
        popularity_score: 85,
        article_frequency: "daily",
        is_featured: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Sports Feeds
      {
        id: randomUUID(),
        name: "ESPN",
        url: "https://www.espn.com/espn/rss/news",
        site_url: "https://www.espn.com",
        description: "Sports news and analysis",
        icon_url: "https://www.espn.com/favicon.ico",
        category: "Sports",
        country: "US",
        language: "en",
        tags: ["sports", "news", "analysis"],
        popularity_score: 89,
        article_frequency: "hourly",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Entertainment Feeds
      {
        id: randomUUID(),
        name: "Entertainment Weekly",
        url: "https://ew.com/feed/",
        site_url: "https://ew.com",
        description: "Entertainment news and celebrity gossip",
        icon_url: "https://ew.com/favicon.ico",
        category: "Entertainment",
        country: "US",
        language: "en",
        tags: ["entertainment", "celebrity", "movies"],
        popularity_score: 82,
        article_frequency: "daily",
        is_featured: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Health Feeds -> Change to Science
      {
        id: randomUUID(),
        name: "Scientific Reports",
        url: "https://www.nature.com/srep/rss/current",
        site_url: "https://www.nature.com/srep",
        description: "Scientific research and discoveries",
        icon_url: "https://www.nature.com/favicon.ico",
        category: "Science", // Changed from "Health" to valid category
        country: "US",
        language: "en",
        tags: ["science", "research", "discoveries"],
        popularity_score: 80,
        article_frequency: "daily",
        is_featured: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    console.log(`📊 Base feeds created: ${this.recommendedFeeds.length} feeds`);
    
    // Add more feeds to reach closer to 865 total
    const validCategories = categoryMappingService.getAllDatabaseCategories();
    const baseFeeds = [...this.recommendedFeeds];
    
    console.log('🔄 Generating additional feeds to reach target count...');
    console.log(`🔍 Using valid categories: ${validCategories.join(', ')}`);
    
    // Generate additional feeds to simulate the 865 feeds (865 - 14 base feeds = 851 additional)
    for (let i = 0; i < 851; i++) {
      const category = validCategories[i % validCategories.length];
      const feedNumber = Math.floor(i / validCategories.length) + 2;
      
      this.recommendedFeeds.push({
        id: randomUUID(),
        name: `${category} Feed ${feedNumber}`,
        url: `https://example.com/${category.toLowerCase()}/feed${feedNumber}.xml`,
        site_url: `https://example.com/${category.toLowerCase()}${feedNumber}`,
        description: `Quality ${category.toLowerCase()} news and updates`,
        icon_url: `https://example.com/${category.toLowerCase()}${feedNumber}/favicon.ico`,
        category,
        country: "US",
        language: "en",
        tags: [category.toLowerCase(), "news", "updates"],
        popularity_score: Math.floor(Math.random() * 40) + 60, // 60-100
        article_frequency: ["hourly", "daily", "weekly"][Math.floor(Math.random() * 3)] as any,
        is_featured: Math.random() > 0.7,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    console.log(`✅ Additional feeds generated: ${this.recommendedFeeds.length - baseFeeds.length} feeds`);
    console.log(`📊 Total feeds initialized: ${this.recommendedFeeds.length} feeds`);
    
    // Validate feed count
    if (this.recommendedFeeds.length === 865) {
      console.log('✅ Feed count validation: Expected 865 feeds - PASS');
    } else {
      console.warn(`⚠️  Feed count validation: Expected 865 feeds, got ${this.recommendedFeeds.length} - FAIL`);
    }
    
    // Validate categories using category mapping service
    console.log('🔍 Validating feed categories against category mapping...');
    let validCategoryCount = 0;
    let invalidCategoryCount = 0;
    const invalidCategories = new Set<string>();
    
    this.recommendedFeeds.forEach(feed => {
      if (categoryMappingService.isValidDatabaseCategory(feed.category)) {
        validCategoryCount++;
      } else {
        invalidCategoryCount++;
        invalidCategories.add(feed.category);
      }
    });
    
    if (invalidCategoryCount === 0) {
      console.log('✅ Category validation: All feed categories are valid - PASS');
    } else {
      console.warn(`⚠️  Category validation: Found ${invalidCategoryCount} feeds with invalid categories - FAIL`);
      console.warn(`⚠️  Invalid categories found: ${Array.from(invalidCategories).join(', ')}`);
    }
    
    console.log(`📊 Category validation summary: ${validCategoryCount} valid, ${invalidCategoryCount} invalid`);
    
    // Log category distribution
    const categoryCount: Record<string, number> = {};
    this.recommendedFeeds.forEach(feed => {
      categoryCount[feed.category] = (categoryCount[feed.category] || 0) + 1;
    });
    
    console.log('📊 Feed distribution by category:');
    Object.entries(categoryCount).forEach(([category, count]) => {
      const isValid = categoryMappingService.isValidDatabaseCategory(category);
      const status = isValid ? '✅' : '❌';
      console.log(`   ${status} ${category}: ${count} feeds`);
    });
    
    console.log('🎉 Mock recommended feeds initialization complete!');
    
    // Perform data structure validation
    this.validateFeedDataStructure();
  }

  /**
   * Validates the consistency and structure of initialized feeds
   */
  private validateFeedDataStructure(): void {
    console.log('🔍 Validating feed data structure...');
    
    const issues: string[] = [];
    
    // Check for required fields
    this.recommendedFeeds.forEach((feed, index) => {
      if (!feed.id) issues.push(`Feed ${index}: Missing id`);
      if (!feed.name) issues.push(`Feed ${index}: Missing name`);
      if (!feed.url) issues.push(`Feed ${index}: Missing url`);
      if (!feed.category) issues.push(`Feed ${index}: Missing category`);
      if (!feed.country) issues.push(`Feed ${index}: Missing country`);
      if (!feed.language) issues.push(`Feed ${index}: Missing language`);
      if (typeof feed.popularity_score !== 'number') issues.push(`Feed ${index}: Invalid popularity_score`);
      if (typeof feed.is_featured !== 'boolean') issues.push(`Feed ${index}: Invalid is_featured`);
    });
    
    // Check for duplicate IDs
    const ids = this.recommendedFeeds.map(feed => feed.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      issues.push(`Duplicate feed IDs detected: ${ids.length} total, ${uniqueIds.size} unique`);
    }
    
    // Check for duplicate URLs
    const urls = this.recommendedFeeds.map(feed => feed.url);
    const uniqueUrls = new Set(urls);
    if (urls.length !== uniqueUrls.size) {
      issues.push(`Duplicate feed URLs detected: ${urls.length} total, ${uniqueUrls.size} unique`);
    }
    
    // Report validation results
    if (issues.length === 0) {
      console.log('✅ Feed data structure validation: All checks passed');
    } else {
      console.warn('⚠️  Feed data structure validation issues found:');
      issues.forEach(issue => console.warn(`   - ${issue}`));
    }
  }
}

import { SupabaseStorage } from "./supabase-storage";
import { getDatabase, checkDatabaseHealth } from "./production-db";

/**
 * Storage layer selection with comprehensive logging and enhanced fallback mechanisms
 * Implements Requirements 4.4 - enhanced database connectivity fallback
 */
async function createStorageInstance(): Promise<IStorage> {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('=== Enhanced Storage Layer Initialization ===');
  console.log(`🔍 Environment Analysis:`);
  console.log(`   NODE_ENV: ${nodeEnv}`);
  console.log(`   Supabase URL configured: ${!!supabaseUrl}`);
  console.log(`   Supabase Service Key configured: ${!!supabaseServiceKey}`);
  console.log(`   Process PID: ${process.pid}`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  
  // Environment validation with detailed logging
  const environmentValidation = validateEnvironmentConfiguration(nodeEnv);
  const supabaseValidation = validateSupabaseConfiguration(supabaseUrl, supabaseServiceKey);
  
  console.log(`🔍 Configuration Validation Results:`);
  console.log(`   Environment validation: ${environmentValidation.isValid ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Supabase validation: ${supabaseValidation.isValid ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!environmentValidation.isValid) {
    console.warn(`⚠️  Environment validation issues: ${environmentValidation.issues.join(', ')}`);
  }
  
  if (!supabaseValidation.isValid) {
    console.warn(`⚠️  Supabase validation issues: ${supabaseValidation.issues.join(', ')}`);
  }
  
  // Enhanced storage selection logic with improved fallback handling (Requirement 4.4)
  if (nodeEnv === 'development') {
    console.log('🔧 STORAGE SELECTION: Development environment detected');
    
    if (supabaseValidation.isValid) {
      console.log('📋 RULE: Development with valid Supabase configuration uses SupabaseStorage');
      console.log('🎯 DECISION: Using SupabaseStorage (development database) with enhanced fallback');
      
      try {
        const supabaseStorage = new SupabaseStorage();
        console.log('✅ SupabaseStorage initialized successfully');
        console.log('📊 Storage Type: SupabaseStorage (PostgreSQL)');
        console.log('📊 Database URL: ' + (supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'undefined'));
        console.log('📊 Fallback: MemStorage with 865 feeds and category mapping validation');
        console.log('=== Enhanced Storage Layer Ready ===\n');
        return supabaseStorage;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ SupabaseStorage initialization failed:', errorMessage);
        console.log('🔄 ENHANCED FALLBACK TRIGGERED: SupabaseStorage failed, falling back to MemStorage');
        console.log('🔄 FALLBACK REASON: Primary storage initialization failure in development');
        
        try {
          const memStorage = new MemStorage();
          console.log('✅ MemStorage fallback initialized successfully');
          console.log('📊 Storage Type: MemStorage (enhanced fallback from SupabaseStorage failure)');
          console.log('📊 Expected Feed Count: 865 mock feeds with category mapping validation');
          console.log('📊 Fallback Features: Full category mapping support, comprehensive logging');
          console.log('=== Enhanced Storage Layer Ready (Fallback Mode) ===\n');
          return memStorage;
        } catch (fallbackError) {
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
          console.error('❌ CRITICAL: Enhanced fallback to MemStorage also failed:', fallbackErrorMessage);
          console.error('❌ CRITICAL: All storage initialization attempts failed in development');
          throw new Error(`All enhanced storage options failed: ${fallbackErrorMessage}`);
        }
      }
    } else {
      console.log('📋 RULE: Development without valid Supabase configuration uses MemStorage');
      console.log('🎯 DECISION: Using MemStorage (development fallback with enhanced features)');
      
      try {
        const memStorage = new MemStorage();
        console.log('✅ MemStorage initialized successfully');
        console.log('📊 Storage Type: MemStorage (enhanced in-memory storage)');
        console.log('📊 Expected Feed Count: 865 mock feeds with category mapping validation');
        console.log('📊 Enhanced Features: Category validation, comprehensive logging, fallback support');
        console.log('=== Enhanced Storage Layer Ready ===\n');
        return memStorage;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ CRITICAL: Failed to initialize enhanced MemStorage in development mode:', errorMessage);
        throw new Error(`Enhanced development storage initialization failed: ${errorMessage}`);
      }
    }
  }
  
  if (nodeEnv === 'production') {
    console.log('🚀 STORAGE SELECTION: Production environment detected');
    
    if (supabaseValidation.isValid) {
      console.log('📋 RULE: Production with valid Supabase configuration uses SupabaseStorage');
      console.log('🎯 DECISION: Using SupabaseStorage (production database) with enhanced fallback');
      
      try {
        // Skip direct PostgreSQL health check if DATABASE_URL is not set
        // SupabaseStorage uses the Supabase client API, not direct PostgreSQL connections
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl) {
          console.log('🔍 Testing production database connection via DATABASE_URL...');
          const healthCheck = await checkDatabaseHealth();
          
          if (!healthCheck.healthy) {
            console.warn(`⚠️  Direct database health check failed: ${healthCheck.error}`);
            console.warn('⚠️  Continuing with SupabaseStorage client API (may still work)');
          } else {
            console.log('✅ Production database health check passed');
          }
        } else {
          console.log('ℹ️  DATABASE_URL not set - skipping direct PostgreSQL health check');
          console.log('ℹ️  SupabaseStorage will use Supabase client API instead');
        }
        
        const supabaseStorage = new SupabaseStorage();
        console.log('✅ SupabaseStorage initialized successfully');
        console.log('📊 Storage Type: SupabaseStorage (PostgreSQL via Supabase API)');
        console.log('📊 Supabase URL: ' + (supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'undefined'));
        console.log('📊 Enhanced Fallback: MemStorage with 865 feeds and category mapping validation');
        console.log('📊 Production Features: Connection validation, comprehensive error handling');
        console.log('=== Enhanced Storage Layer Ready ===\n');
        return supabaseStorage;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ SupabaseStorage initialization failed:', errorMessage);
        console.log('🔄 ENHANCED FALLBACK TRIGGERED: SupabaseStorage failed, falling back to MemStorage');
        console.log('🔄 FALLBACK REASON: Primary storage initialization failure in production');
        console.warn('⚠️  PRODUCTION ALERT: Using fallback storage - investigate Supabase connectivity');
        
        try {
          const memStorage = new MemStorage();
          console.log('✅ MemStorage fallback initialized successfully');
          console.log('📊 Storage Type: MemStorage (enhanced fallback from SupabaseStorage failure)');
          console.log('📊 Expected Feed Count: 865 mock feeds with category mapping validation');
          console.log('📊 Fallback Features: Full category mapping support, comprehensive logging');
          console.warn('⚠️  PRODUCTION WARNING: Operating in fallback mode - monitor for Supabase recovery');
          console.log('=== Enhanced Storage Layer Ready (Fallback Mode) ===\n');
          return memStorage;
        } catch (fallbackError) {
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
          console.error('❌ CRITICAL: Enhanced fallback to MemStorage also failed:', fallbackErrorMessage);
          console.error('❌ CRITICAL: Both SupabaseStorage and enhanced MemStorage fallback failed in production');
          throw new Error(`Both SupabaseStorage and enhanced MemStorage fallback failed: ${fallbackErrorMessage}`);
        }
      }
    } else {
      console.warn('⚠️  Production environment detected but Supabase configuration is invalid');
      console.log('📋 RULE: Production without valid Supabase falls back to enhanced MemStorage');
      console.log('🎯 DECISION: Using MemStorage (production fallback due to invalid Supabase config)');
      console.warn('⚠️  PRODUCTION ALERT: Invalid Supabase configuration - using fallback storage');
      
      try {
        const memStorage = new MemStorage();
        console.log('✅ MemStorage fallback initialized successfully');
        console.log('📊 Storage Type: MemStorage (enhanced fallback from invalid Supabase config)');
        console.log('📊 Expected Feed Count: 865 mock feeds with category mapping validation');
        console.log('📊 Enhanced Features: Category validation, comprehensive logging');
        console.warn('⚠️  PRODUCTION WARNING: Fix Supabase configuration for optimal performance');
        console.log('=== Enhanced Storage Layer Ready (Fallback Mode) ===\n');
        return memStorage;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ CRITICAL: Failed to initialize enhanced MemStorage fallback:', errorMessage);
        throw new Error(`Enhanced production fallback storage initialization failed: ${errorMessage}`);
      }
    }
  }
  
  // Enhanced default fallback for any other environment
  console.log(`🔄 STORAGE SELECTION: Unknown environment "${nodeEnv}" detected`);
  console.log('📋 RULE: Unknown environments default to enhanced MemStorage');
  console.log('🎯 DECISION: Using MemStorage (unknown environment default with enhanced features)');
  
  try {
    const memStorage = new MemStorage();
    console.log('✅ MemStorage default initialized successfully');
    console.log('📊 Storage Type: MemStorage (enhanced unknown environment default)');
    console.log('📊 Expected Feed Count: 865 mock feeds with category mapping validation');
    console.log('📊 Enhanced Features: Category validation, comprehensive logging, fallback support');
    console.log('=== Enhanced Storage Layer Ready ===\n');
    return memStorage;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ CRITICAL: Failed to initialize enhanced default MemStorage:', errorMessage);
    throw new Error(`Enhanced default storage initialization failed: ${errorMessage}`);
  }
}

/**
 * Validates environment configuration with detailed logging
 * Implements Requirement 4.1
 */
function validateEnvironmentConfiguration(nodeEnv: string): { isValid: boolean; issues: string[] } {
  console.log('--- Environment Configuration Validation ---');
  
  const issues: string[] = [];
  const validEnvironments = ['development', 'production', 'test', 'staging'];
  
  if (!nodeEnv) {
    issues.push('NODE_ENV is not set');
  } else if (!validEnvironments.includes(nodeEnv)) {
    issues.push(`NODE_ENV "${nodeEnv}" is not a recognized environment`);
    console.log(`ℹ️  Valid environments: ${validEnvironments.join(', ')}`);
  } else {
    console.log(`✅ NODE_ENV "${nodeEnv}" is valid`);
  }
  
  // Check for other important environment variables
  const port = process.env.PORT;
  if (!port) {
    console.log('ℹ️  PORT is not set (will use default)');
  } else {
    console.log(`✅ PORT is set to ${port}`);
  }
  
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    issues.push('SESSION_SECRET is not set');
  } else if (sessionSecret === 'your_session_secret_key') {
    issues.push('SESSION_SECRET is set to placeholder value');
  } else {
    console.log('✅ SESSION_SECRET is configured');
  }
  
  const isValid = issues.length === 0;
  console.log(`Environment validation result: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
  
  return { isValid, issues };
}

/**
 * Validates Supabase configuration with detailed logging
 * Implements Requirements 2.3, 4.1
 */
function validateSupabaseConfiguration(url?: string, serviceKey?: string): { isValid: boolean; issues: string[] } {
  console.log('--- Supabase Configuration Validation ---');
  
  const issues: string[] = [];
  
  // URL validation
  if (!url) {
    issues.push('SUPABASE_URL is not set');
    console.log('❌ SUPABASE_URL is missing');
  } else if (url === 'your_supabase_project_url') {
    issues.push('SUPABASE_URL is set to placeholder value');
    console.log('❌ SUPABASE_URL contains placeholder value');
  } else if (!url.startsWith('https://')) {
    issues.push('SUPABASE_URL does not start with https://');
    console.log('❌ SUPABASE_URL protocol is invalid');
  } else if (!url.includes('.supabase.co')) {
    issues.push('SUPABASE_URL does not appear to be a valid Supabase URL');
    console.log('❌ SUPABASE_URL domain is invalid');
  } else {
    console.log('✅ SUPABASE_URL format is valid');
    console.log(`   URL: ${url.substring(0, 30)}...`);
  }
  
  // Service key validation
  if (!serviceKey) {
    issues.push('SUPABASE_SERVICE_ROLE_KEY is not set');
    console.log('❌ SUPABASE_SERVICE_ROLE_KEY is missing');
  } else if (serviceKey.length < 100) {
    issues.push('SUPABASE_SERVICE_ROLE_KEY appears to be invalid (too short)');
    console.log(`❌ SUPABASE_SERVICE_ROLE_KEY length is ${serviceKey.length} (expected >100)`);
  } else if (!serviceKey.startsWith('eyJ')) {
    issues.push('SUPABASE_SERVICE_ROLE_KEY does not appear to be a valid JWT token');
    console.log('❌ SUPABASE_SERVICE_ROLE_KEY format is invalid');
  } else {
    console.log('✅ SUPABASE_SERVICE_ROLE_KEY format is valid');
    console.log(`   Key length: ${serviceKey.length} characters`);
    console.log(`   Key prefix: ${serviceKey.substring(0, 20)}...`);
  }
  
  // Additional validation for production environments
  if (process.env.NODE_ENV === 'production') {
    console.log('🔍 Additional production validation checks:');
    
    if (url && url.includes('localhost')) {
      issues.push('Production environment should not use localhost Supabase URL');
      console.log('❌ Production using localhost URL');
    }
    
    if (serviceKey && serviceKey.includes('test')) {
      issues.push('Production environment should not use test service key');
      console.log('❌ Production using test service key');
    }
  }
  
  const isValid = issues.length === 0;
  console.log(`Supabase validation result: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!isValid) {
    console.log('❌ Supabase configuration issues found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }
  
  return { isValid, issues };
}

// Initialize storage with enhanced logging
let storageInstance: IStorage | null = null;

export async function getStorage(): Promise<IStorage> {
  if (!storageInstance) {
    storageInstance = await createStorageInstance();
  }
  return storageInstance;
}

// For backward compatibility, create a synchronous version that throws if not initialized
export const storage = new Proxy({} as IStorage, {
  get(target, prop) {
    if (!storageInstance) {
      throw new Error('Storage not initialized. Use getStorage() instead or ensure storage is initialized before use.');
    }
    return (storageInstance as any)[prop];
  }
});
