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
  type InsertCluster,
  type AIUsageLog,
  type InsertAIUsageLog,
  type AIUsageDaily,
  type InsertAIUsageDaily,
  type AIOperation,
  type AIProvider,
  type FeedPriority,
  MAX_FEEDS_PER_USER,
  type EngagementSignal
} from "@shared/schema";
import { categoryMappingService } from "@shared/category-mapping";
import { randomUUID } from "crypto";

// Authentication result type with session tokens for JWT auth in production
export interface AuthResult {
  profile: Profile;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  };
}

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User Management
  getUser(id: string): Promise<Profile | undefined>;
  getUserByEmail(email: string): Promise<Profile | undefined>;
  createUser(user: InsertProfile): Promise<Profile>;
  updateUser(id: string, updates: Partial<Profile>): Promise<Profile>;
  
  // Authentication Methods
  authenticateUser(email: string, password: string): Promise<AuthResult | null>;
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
  
  // Categories - Get distinct categories from recommended_feeds
  getCategories(): Promise<Array<{ category: string; feedCount: number }>>;
  
  // Recommended Feeds Management with Category Validation
  createRecommendedFeed(feed: InsertRecommendedFeed): Promise<RecommendedFeed>;
  updateRecommendedFeed(id: string, updates: Partial<RecommendedFeed>): Promise<RecommendedFeed>;
  
  // Custom Feed Management (Requirements: 1.2, 1.3)
  createCustomFeed(feed: {
    url: string;
    name: string;
    description?: string;
    siteUrl?: string;
    iconUrl?: string;
    category?: string;
    createdBy: string;
  }): Promise<RecommendedFeed>;
  getRecommendedFeedByUrl(url: string): Promise<RecommendedFeed | undefined>;
  
  // User Feed Subscription Management
  getUserFeeds(userId: string): Promise<Feed[]>;
  subscribeToFeeds(userId: string, feedIds: string[]): Promise<void>;
  unsubscribeFromFeed(userId: string, feedId: string): Promise<void>;
  clearUserSubscriptions(userId: string): Promise<number>; // Returns count of removed subscriptions
  
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
    isActive: boolean;
    currentFeed?: string;
    errors: Array<{ feedId: string; feedName: string; error: string }>;
    newArticlesCount: number;
  }>;
  
  // Article Management
  createArticle(article: InsertArticle): Promise<Article>;
  updateArticle(id: string, updates: Partial<Article>): Promise<Article>;
  getArticleByGuid(feedId: string, guid: string): Promise<Article | undefined>;
  getArticlesByFeedId(feedId: string, limit?: number): Promise<Article[]>;
  cleanupOldArticles(userId: string, maxArticles: number): Promise<number>;
  
  // User Article Management
  getUserArticleState(userId: string, articleId: string): Promise<UserArticle | undefined>;
  getUserArticleStates(userId: string, articleIds: string[]): Promise<Map<string, UserArticle>>;
  createUserArticleState(userArticle: InsertUserArticle): Promise<UserArticle>;
  updateUserArticleState(userId: string, articleId: string, updates: Partial<UserArticle>): Promise<UserArticle>;
  
  // Feed Count and Limit Management (Requirements: 5.1, 5.2, 3.1, 3.2, 3.3, 3.5)
  getUserFeedCount(userId: string): Promise<number>;
  subscribeToFeedsWithLimit(
    userId: string, 
    feedIds: string[], 
    maxLimit: number
  ): Promise<{ subscribed: string[]; rejected: string[]; reason?: string }>;
  
  // Article State Management - Enhanced (Requirements: 6.1, 6.2, 7.1, 7.2, 7.3)
  markArticleRead(userId: string, articleId: string, isRead: boolean): Promise<UserArticle>;
  markArticleStarred(userId: string, articleId: string, isStarred: boolean): Promise<UserArticle>;
  getStarredArticles(userId: string, limit?: number, offset?: number): Promise<Article[]>;
  getReadArticles(userId: string, limit?: number, offset?: number): Promise<Article[]>;
  
  // Engagement Signal Management (Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6)
  setEngagementSignal(
    userId: string, 
    articleId: string, 
    signal: 'positive' | 'negative' | null
  ): Promise<UserArticle>;
  getArticlesWithEngagement(userId: string, feedId?: string): Promise<Array<Article & { engagement?: string }>>;
  
  // Embedding Queue Management (Requirements: 1.2, 7.1)
  addToEmbeddingQueue(articleIds: string[], priority?: number): Promise<void>;
  getEmbeddingQueueItems(limit: number, status?: string): Promise<Array<{
    id: string;
    article_id: string;
    priority: number;
    attempts: number;
    max_attempts: number;
    last_attempt_at: Date | null;
    error_message: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
  }>>;
  updateEmbeddingQueueItem(id: string, updates: Partial<{
    priority: number;
    attempts: number;
    last_attempt_at: Date | null;
    error_message: string | null;
    status: string;
  }>): Promise<void>;
  removeFromEmbeddingQueue(articleId: string): Promise<void>;
  getEmbeddingQueueCount(status?: string): Promise<number>;
  
  // Article Embedding Management (Requirements: 1.4, 7.3)
  getArticleById(id: string): Promise<Article | undefined>;
  updateArticleEmbedding(
    articleId: string,
    embedding: number[],
    contentHash: string,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void>;
  
  // Clustering Storage Management (Requirements: 2.1, 2.2, 2.5, 2.6, 2.7)
  getArticlesWithEmbeddings(
    userId?: string,
    feedIds?: string[],
    hoursBack?: number
  ): Promise<Array<{
    id: string;
    title: string;
    excerpt: string | null;
    feedId: string;
    feedName: string;
    embedding: number[];
    publishedAt: Date | null;
    imageUrl?: string | null;
  }>>;
  
  createCluster(cluster: InsertCluster): Promise<Cluster>;
  updateCluster(id: string, updates: Partial<Cluster>): Promise<Cluster>;
  deleteCluster(id: string): Promise<void>;
  getClusterById(id: string): Promise<Cluster | undefined>;
  getClusters(options?: { 
    userId?: string; 
    includeExpired?: boolean;
    limit?: number;
  }): Promise<Cluster[]>;
  
  assignArticlesToCluster(articleIds: string[], clusterId: string): Promise<void>;
  removeArticlesFromCluster(clusterId: string): Promise<void>;
  deleteExpiredClusters(): Promise<number>;
  getArticleIdsByClusterId(clusterId: string): Promise<string[]>;
  
  // Feed Scheduler Management (Requirements: 3.1, 3.2, 3.3, 6.2, 6.6)
  getFeedById(feedId: string): Promise<Feed | undefined>;
  getAllActiveFeeds(): Promise<Feed[]>;
  getFeedsDueForSync(limit?: number): Promise<Feed[]>;
  updateFeedPriority(feedId: string, priority: FeedPriority): Promise<Feed>;
  updateFeedSchedule(feedId: string, updates: {
    sync_priority?: string;
    next_sync_at?: Date;
    sync_interval_hours?: number;
    last_fetched_at?: Date;
  }): Promise<Feed>;
  getNewArticleIds(feedId: string, since: Date): Promise<string[]>;
  
  // Feed Health Tracking
  getFeedHealthStats(feedId: string, days?: number): Promise<{
    feedId: string;
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    lastSyncAt: Date | null;
    lastSyncStatus: 'success' | 'error' | 'in_progress' | null;
    lastError: string | null;
    avgSyncDuration: number;
    totalArticlesFound: number;
    totalArticlesNew: number;
    recentSyncs: Array<{
      id: string;
      status: string;
      startedAt: Date;
      completedAt: Date | null;
      duration: number | null;
      articlesFound: number;
      articlesNew: number;
      error: string | null;
    }>;
  }>;
  
  getAllFeedsHealthStats(userId: string): Promise<Array<{
    feedId: string;
    feedName: string;
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    lastSyncAt: Date | null;
    lastSyncStatus: 'success' | 'error' | 'in_progress' | null;
    lastError: string | null;
  }>>;
  
  // AI Rate Limiter Storage (Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6)
  recordUsageLog(usage: InsertAIUsageLog): Promise<AIUsageLog>;
  getDailyUsage(userId: string, date: string): Promise<AIUsageDaily | undefined>;
  upsertDailyUsage(usage: InsertAIUsageDaily): Promise<AIUsageDaily>;
  incrementDailyUsage(
    userId: string,
    date: string,
    operation: AIOperation,
    tokenCount: number,
    provider: AIProvider,
    cost: number
  ): Promise<AIUsageDaily>;
  getUsageStats(userId: string, days?: number): Promise<AIUsageDaily[]>;
  
  // Dead Letter Queue (Requirements: 9.4)
  addToDeadLetterQueue(item: {
    operation: AIOperation;
    provider: AIProvider;
    userId?: string;
    payload: unknown;
    errorMessage: string;
    attempts: number;
    lastAttemptAt: Date;
  }): Promise<void>;
  getDeadLetterItems(limit?: number): Promise<Array<{
    id: string;
    operation: AIOperation;
    provider: AIProvider;
    userId?: string;
    payload: unknown;
    errorMessage: string;
    attempts: number;
    createdAt: Date;
    lastAttemptAt: Date;
  }>>;
  removeFromDeadLetterQueue(id: string): Promise<void>;
  
  // Article Counts per Feed
  getArticleCountsByFeed(userId: string): Promise<Map<string, number>>;
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
    
    console.log(`✅ MemStorage initialized with ${this.recommendedFeeds.length} real recommended feeds`);
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
  async authenticateUser(email: string, password: string): Promise<AuthResult | null> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      return null;
    }

    const storedPassword = this.passwords.get(user.id);
    if (!storedPassword || storedPassword !== password) {
      return null;
    }

    // In development with MemStorage, create a mock session
    // This allows the same code path to work, but Express sessions handle persistence
    return {
      profile: user,
      session: {
        access_token: 'dev-token-' + user.id,
        refresh_token: 'dev-refresh-' + user.id,
        expires_at: Math.floor(Date.now() / 1000) + 86400 // 24 hours
      }
    };
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
    
    // Validate data consistency - we now use real feeds only
    if (this.recommendedFeeds.length === 0) {
      console.warn('⚠️  MemStorage: No recommended feeds available - this may indicate an initialization issue');
    } else {
      console.log(`✅ MemStorage: ${this.recommendedFeeds.length} real feeds available`);
    }
    
    return this.recommendedFeeds;
  }

  // Get distinct categories with feed counts
  async getCategories(): Promise<Array<{ category: string; feedCount: number }>> {
    const categoryCounts = new Map<string, number>();
    for (const feed of this.recommendedFeeds) {
      const count = categoryCounts.get(feed.category) || 0;
      categoryCounts.set(feed.category, count + 1);
    }
    
    return Array.from(categoryCounts.entries())
      .map(([category, feedCount]) => ({ category, feedCount }))
      .sort((a, b) => b.feedCount - a.feedCount);
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
      default_priority: insertFeed.default_priority || "medium",
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

  // Custom Feed Management (Requirements: 1.2, 1.3)
  async createCustomFeed(feed: {
    url: string;
    name: string;
    description?: string;
    siteUrl?: string;
    iconUrl?: string;
    category?: string;
    createdBy: string;
  }): Promise<RecommendedFeed> {
    console.log(`🔍 MemStorage: Creating custom feed for user ${feed.createdBy}...`);
    
    // Check if feed with this URL already exists
    const existingFeed = this.recommendedFeeds.find(f => f.url === feed.url);
    if (existingFeed) {
      console.log(`⚠️  MemStorage: Feed with URL ${feed.url} already exists, returning existing feed`);
      return existingFeed;
    }
    
    // Use 'Custom' as default category for custom feeds
    const category = feed.category || 'Custom';
    
    const id = randomUUID();
    const customFeed: RecommendedFeed = {
      id,
      name: feed.name,
      url: feed.url,
      site_url: feed.siteUrl || null,
      description: feed.description || null,
      icon_url: feed.iconUrl || null,
      category,
      country: null,
      language: "en",
      tags: ['custom'],
      popularity_score: 0,
      article_frequency: null,
      is_featured: false,
      default_priority: "medium",
      created_at: new Date(),
      updated_at: new Date()
    };
    
    this.recommendedFeeds.push(customFeed);
    console.log(`✅ MemStorage: Custom feed created successfully: ${customFeed.name} (${customFeed.id})`);
    
    return customFeed;
  }

  async getRecommendedFeedByUrl(url: string): Promise<RecommendedFeed | undefined> {
    return this.recommendedFeeds.find(feed => feed.url === url);
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
          folder_name: recommendedFeed.category, // Preserve category for sidebar grouping
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

  async clearUserSubscriptions(userId: string): Promise<number> {
    const existingFeeds = this.userFeeds.get(userId) || [];
    const count = existingFeeds.length;
    this.userFeeds.set(userId, []);
    return count;
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
    isActive: boolean;
    currentFeed?: string;
    errors: Array<{ feedId: string; feedName: string; error: string }>;
    newArticlesCount: number;
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
    
    // Get errors from failed syncs
    const errors: Array<{ feedId: string; feedName: string; error: string }> = [];
    latestSyncs.filter(log => log.status === "error").forEach(log => {
      const feed = userFeeds.find(f => f.id === log.feed_id);
      errors.push({
        feedId: log.feed_id,
        feedName: feed?.name || 'Unknown Feed',
        error: log.error_message || 'Unknown error'
      });
    });
    
    // Get current syncing feed name
    const currentSyncingLog = latestSyncs.find(log => log.status === "in_progress");
    const currentFeed = currentSyncingLog 
      ? userFeeds.find(f => f.id === currentSyncingLog.feed_id)?.name 
      : undefined;
    
    // Calculate total new articles from successful syncs
    const newArticlesCount = latestSyncs
      .filter(log => log.status === "success")
      .reduce((sum, log) => sum + (log.articles_new || 0), 0);
    
    return {
      totalFeeds: userFeeds.length,
      syncing,
      completed,
      failed,
      lastSyncAt,
      isActive: syncing > 0,
      currentFeed,
      errors,
      newArticlesCount
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

  async cleanupOldArticles(userId: string, maxArticles: number): Promise<number> {
    // Get user's feeds
    const userFeeds = Array.from(this.userFeeds.values())
      .filter(uf => uf.user_id === userId)
      .map(uf => uf.feed_id);
    
    // Get all articles from user's feeds
    const articles = Array.from(this.articles.values())
      .filter(a => userFeeds.includes(a.feed_id))
      .sort((a, b) => (b.published_at?.getTime() || 0) - (a.published_at?.getTime() || 0));
    
    if (articles.length <= maxArticles) return 0;
    
    // Delete old articles
    const toDelete = articles.slice(maxArticles);
    toDelete.forEach(a => this.articles.delete(a.id));
    
    return toDelete.length;
  }

  // User Article Management
  async getUserArticleState(userId: string, articleId: string): Promise<UserArticle | undefined> {
    const key = `${userId}:${articleId}`;
    return this.userArticles.get(key);
  }

  async getUserArticleStates(userId: string, articleIds: string[]): Promise<Map<string, UserArticle>> {
    const result = new Map<string, UserArticle>();
    for (const articleId of articleIds) {
      const key = `${userId}:${articleId}`;
      const state = this.userArticles.get(key);
      if (state) {
        result.set(articleId, state);
      }
    }
    return result;
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
      engagement_signal: insertUserArticle.engagement_signal || null,
      engagement_signal_at: insertUserArticle.engagement_signal_at || null,
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

  // Feed Count and Limit Management (Requirements: 5.1, 5.2)
  async getUserFeedCount(userId: string): Promise<number> {
    const userFeeds = this.userFeeds.get(userId) || [];
    return userFeeds.length;
  }

  // Subscription with Limit Checking (Requirements: 3.1, 3.2, 3.3, 3.5)
  async subscribeToFeedsWithLimit(
    userId: string, 
    feedIds: string[], 
    maxLimit: number
  ): Promise<{ subscribed: string[]; rejected: string[]; reason?: string }> {
    const currentCount = await this.getUserFeedCount(userId);
    const availableSlots = maxLimit - currentCount;
    
    if (availableSlots <= 0) {
      return {
        subscribed: [],
        rejected: feedIds,
        reason: `Feed limit reached. You have ${currentCount}/${maxLimit} feeds. Remove some feeds to add new ones.`
      };
    }
    
    const feedsToSubscribe = feedIds.slice(0, availableSlots);
    const rejectedFeeds = feedIds.slice(availableSlots);
    
    // Subscribe to the allowed feeds
    if (feedsToSubscribe.length > 0) {
      await this.subscribeToFeeds(userId, feedsToSubscribe);
    }
    
    const result: { subscribed: string[]; rejected: string[]; reason?: string } = {
      subscribed: feedsToSubscribe,
      rejected: rejectedFeeds
    };
    
    if (rejectedFeeds.length > 0) {
      result.reason = `Partial subscription: ${feedsToSubscribe.length} feeds added, ${rejectedFeeds.length} rejected due to limit (${maxLimit} max).`;
    }
    
    return result;
  }

  // Article State Management - Enhanced (Requirements: 6.1, 6.2)
  async markArticleRead(userId: string, articleId: string, isRead: boolean): Promise<UserArticle> {
    const updates: Partial<UserArticle> = {
      is_read: isRead,
      read_at: isRead ? new Date() : null
    };
    return this.updateUserArticleState(userId, articleId, updates);
  }

  // Article Starred State (Requirements: 7.1, 7.2)
  async markArticleStarred(userId: string, articleId: string, isStarred: boolean): Promise<UserArticle> {
    const updates: Partial<UserArticle> = {
      is_starred: isStarred,
      starred_at: isStarred ? new Date() : null
    };
    return this.updateUserArticleState(userId, articleId, updates);
  }

  // Get Starred Articles (Requirements: 7.3)
  async getStarredArticles(userId: string, limit?: number, offset?: number): Promise<Article[]> {
    const starredArticleIds: string[] = [];
    
    // Find all starred user articles for this user
    this.userArticles.forEach((userArticle, key) => {
      if (key.startsWith(`${userId}:`) && userArticle.is_starred) {
        starredArticleIds.push(userArticle.article_id);
      }
    });
    
    // Get the actual articles
    const starredArticles: Article[] = [];
    starredArticleIds.forEach(articleId => {
      const article = this.articles.get(articleId);
      if (article) {
        starredArticles.push(article);
      }
    });
    
    // Sort by starred_at timestamp (most recent first)
    starredArticles.sort((a, b) => {
      const userArticleA = this.userArticles.get(`${userId}:${a.id}`);
      const userArticleB = this.userArticles.get(`${userId}:${b.id}`);
      const timeA = userArticleA?.starred_at?.getTime() || 0;
      const timeB = userArticleB?.starred_at?.getTime() || 0;
      return timeB - timeA;
    });
    
    // Apply pagination
    const startIndex = offset || 0;
    const endIndex = limit ? startIndex + limit : undefined;
    
    return starredArticles.slice(startIndex, endIndex);
  }

  // Get Read Articles (Requirements: 6.1, 6.2)
  async getReadArticles(userId: string, limit?: number, offset?: number): Promise<Article[]> {
    const readArticleIds: string[] = [];
    
    // Find all read user articles for this user
    this.userArticles.forEach((userArticle, key) => {
      if (key.startsWith(`${userId}:`) && userArticle.is_read) {
        readArticleIds.push(userArticle.article_id);
      }
    });
    
    // Get the actual articles
    const readArticles: Article[] = [];
    readArticleIds.forEach(articleId => {
      const article = this.articles.get(articleId);
      if (article) {
        readArticles.push(article);
      }
    });
    
    // Sort by read_at timestamp (most recent first)
    readArticles.sort((a, b) => {
      const userArticleA = this.userArticles.get(`${userId}:${a.id}`);
      const userArticleB = this.userArticles.get(`${userId}:${b.id}`);
      const timeA = userArticleA?.read_at?.getTime() || 0;
      const timeB = userArticleB?.read_at?.getTime() || 0;
      return timeB - timeA;
    });
    
    // Apply pagination
    const startIndex = offset || 0;
    const endIndex = limit ? startIndex + limit : undefined;
    
    return readArticles.slice(startIndex, endIndex);
  }

  // Engagement Signal Management (Requirements: 8.1, 8.2, 8.3, 8.4)
  async setEngagementSignal(
    userId: string, 
    articleId: string, 
    signal: EngagementSignal
  ): Promise<UserArticle> {
    const updates: Partial<UserArticle> = {
      engagement_signal: signal,
      engagement_signal_at: signal ? new Date() : null
    };
    return this.updateUserArticleState(userId, articleId, updates);
  }

  // Get Articles with Engagement (Requirements: 8.5, 8.6)
  async getArticlesWithEngagement(userId: string, feedId?: string): Promise<Array<Article & { engagement?: string }>> {
    const result: Array<Article & { engagement?: string }> = [];
    
    // Get all articles, optionally filtered by feedId
    this.articles.forEach((article) => {
      if (feedId && article.feed_id !== feedId) {
        return;
      }
      
      const userArticle = this.userArticles.get(`${userId}:${article.id}`);
      const articleWithEngagement: Article & { engagement?: string } = {
        ...article,
        engagement: userArticle?.engagement_signal || undefined
      };
      result.push(articleWithEngagement);
    });
    
    // Sort by published_at (most recent first)
    result.sort((a, b) => {
      const timeA = a.published_at?.getTime() || 0;
      const timeB = b.published_at?.getTime() || 0;
      return timeB - timeA;
    });
    
    return result;
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
      },
      
      // Gaming Feeds
      {
        id: randomUUID(),
        name: "IGN",
        url: "https://feeds.ign.com/ign/games-all",
        site_url: "https://www.ign.com",
        description: "Video game news and reviews",
        icon_url: "https://www.ign.com/favicon.ico",
        category: "Gaming",
        country: "US",
        language: "en",
        tags: ["gaming", "reviews", "news"],
        popularity_score: 85,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "GameSpot",
        url: "https://www.gamespot.com/feeds/mashup/",
        site_url: "https://www.gamespot.com",
        description: "Video game news, reviews, and guides",
        icon_url: "https://www.gamespot.com/favicon.ico",
        category: "Gaming",
        country: "US",
        language: "en",
        tags: ["gaming", "reviews", "guides"],
        popularity_score: 82,
        article_frequency: "daily",
        is_featured: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Programming Feeds
      {
        id: randomUUID(),
        name: "Hacker News",
        url: "https://hnrss.org/frontpage",
        site_url: "https://news.ycombinator.com",
        description: "Social news website focusing on computer science and entrepreneurship",
        icon_url: "https://news.ycombinator.com/favicon.ico",
        category: "Programming",
        country: "US",
        language: "en",
        tags: ["programming", "startups", "tech"],
        popularity_score: 95,
        article_frequency: "hourly",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "Stack Overflow Blog",
        url: "https://stackoverflow.blog/feed/",
        site_url: "https://stackoverflow.blog",
        description: "Programming and developer community news",
        icon_url: "https://stackoverflow.blog/favicon.ico",
        category: "Programming",
        country: "US",
        language: "en",
        tags: ["programming", "development", "community"],
        popularity_score: 88,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Design Feeds
      {
        id: randomUUID(),
        name: "Smashing Magazine",
        url: "https://www.smashingmagazine.com/feed/",
        site_url: "https://www.smashingmagazine.com",
        description: "Web design and development",
        icon_url: "https://www.smashingmagazine.com/favicon.ico",
        category: "Design",
        country: "DE",
        language: "en",
        tags: ["design", "web", "development"],
        popularity_score: 85,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Space Feeds
      {
        id: randomUUID(),
        name: "NASA News",
        url: "https://www.nasa.gov/rss/dyn/breaking_news.rss",
        site_url: "https://www.nasa.gov",
        description: "NASA news and updates",
        icon_url: "https://www.nasa.gov/favicon.ico",
        category: "Space",
        country: "US",
        language: "en",
        tags: ["space", "nasa", "science"],
        popularity_score: 90,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Music Feeds
      {
        id: randomUUID(),
        name: "Rolling Stone",
        url: "https://www.rollingstone.com/feed/",
        site_url: "https://www.rollingstone.com",
        description: "Music news and culture",
        icon_url: "https://www.rollingstone.com/favicon.ico",
        category: "Music",
        country: "US",
        language: "en",
        tags: ["music", "culture", "news"],
        popularity_score: 85,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Food Feeds
      {
        id: randomUUID(),
        name: "Bon Appétit",
        url: "https://www.bonappetit.com/feed/rss",
        site_url: "https://www.bonappetit.com",
        description: "Food and cooking magazine",
        icon_url: "https://www.bonappetit.com/favicon.ico",
        category: "Food",
        country: "US",
        language: "en",
        tags: ["food", "cooking", "recipes"],
        popularity_score: 78,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Travel Feeds
      {
        id: randomUUID(),
        name: "Lonely Planet",
        url: "https://www.lonelyplanet.com/news/feed/rss/",
        site_url: "https://www.lonelyplanet.com",
        description: "Travel guides and news",
        icon_url: "https://www.lonelyplanet.com/favicon.ico",
        category: "Travel",
        country: "AU",
        language: "en",
        tags: ["travel", "guides", "destinations"],
        popularity_score: 85,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // History Feeds
      {
        id: randomUUID(),
        name: "Smithsonian Magazine",
        url: "https://www.smithsonianmag.com/rss/latest_articles/",
        site_url: "https://www.smithsonianmag.com",
        description: "History, science, and culture",
        icon_url: "https://www.smithsonianmag.com/favicon.ico",
        category: "History",
        country: "US",
        language: "en",
        tags: ["history", "science", "culture"],
        popularity_score: 88,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        name: "History Extra",
        url: "https://www.historyextra.com/feed/",
        site_url: "https://www.historyextra.com",
        description: "BBC History Magazine online",
        icon_url: "https://www.historyextra.com/favicon.ico",
        category: "History",
        country: "UK",
        language: "en",
        tags: ["history", "bbc", "magazine"],
        popularity_score: 82,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Books Feeds
      {
        id: randomUUID(),
        name: "The Guardian Books",
        url: "https://www.theguardian.com/books/rss",
        site_url: "https://www.theguardian.com/books",
        description: "Book reviews and author interviews",
        icon_url: "https://www.theguardian.com/favicon.ico",
        category: "Books",
        country: "UK",
        language: "en",
        tags: ["books", "reviews", "literature"],
        popularity_score: 88,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Automotive Feeds
      {
        id: randomUUID(),
        name: "Car and Driver",
        url: "https://www.caranddriver.com/rss/all.xml/",
        site_url: "https://www.caranddriver.com",
        description: "Car reviews and automotive news",
        icon_url: "https://www.caranddriver.com/favicon.ico",
        category: "Automotive",
        country: "US",
        language: "en",
        tags: ["cars", "automotive", "reviews"],
        popularity_score: 88,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // DIY Feeds
      {
        id: randomUUID(),
        name: "Instructables",
        url: "https://www.instructables.com/rss/",
        site_url: "https://www.instructables.com",
        description: "DIY projects and how-to guides",
        icon_url: "https://www.instructables.com/favicon.ico",
        category: "DIY",
        country: "US",
        language: "en",
        tags: ["diy", "projects", "howto"],
        popularity_score: 85,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Android Feeds
      {
        id: randomUUID(),
        name: "Android Police",
        url: "https://www.androidpolice.com/feed/",
        site_url: "https://www.androidpolice.com",
        description: "Android news, reviews, and apps",
        icon_url: "https://www.androidpolice.com/favicon.ico",
        category: "Android",
        country: "US",
        language: "en",
        tags: ["android", "mobile", "apps"],
        popularity_score: 88,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Apple Feeds
      {
        id: randomUUID(),
        name: "9to5Mac",
        url: "https://9to5mac.com/feed/",
        site_url: "https://9to5mac.com",
        description: "Apple news and rumors",
        icon_url: "https://9to5mac.com/favicon.ico",
        category: "Apple",
        country: "US",
        language: "en",
        tags: ["apple", "mac", "iphone"],
        popularity_score: 90,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Humor Feeds
      {
        id: randomUUID(),
        name: "The Onion",
        url: "https://www.theonion.com/rss",
        site_url: "https://www.theonion.com",
        description: "America's Finest News Source",
        icon_url: "https://www.theonion.com/favicon.ico",
        category: "Humor",
        country: "US",
        language: "en",
        tags: ["humor", "satire", "comedy"],
        popularity_score: 90,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Beauty Feeds
      {
        id: randomUUID(),
        name: "Allure",
        url: "https://www.allure.com/feed/rss",
        site_url: "https://www.allure.com",
        description: "Beauty tips, trends, and product reviews",
        icon_url: "https://www.allure.com/favicon.ico",
        category: "Beauty",
        country: "US",
        language: "en",
        tags: ["beauty", "skincare", "makeup"],
        popularity_score: 85,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Fashion Feeds
      {
        id: randomUUID(),
        name: "Vogue",
        url: "https://www.vogue.com/feed/rss",
        site_url: "https://www.vogue.com",
        description: "Fashion news, trends, and runway coverage",
        icon_url: "https://www.vogue.com/favicon.ico",
        category: "Fashion",
        country: "US",
        language: "en",
        tags: ["fashion", "style", "trends"],
        popularity_score: 95,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Startups Feeds
      {
        id: randomUUID(),
        name: "TechCrunch Startups",
        url: "https://techcrunch.com/category/startups/feed/",
        site_url: "https://techcrunch.com/startups",
        description: "Startup news and funding announcements",
        icon_url: "https://techcrunch.com/favicon.ico",
        category: "Startups",
        country: "US",
        language: "en",
        tags: ["startups", "funding", "entrepreneurship"],
        popularity_score: 92,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Cricket Feeds
      {
        id: randomUUID(),
        name: "ESPNcricinfo",
        url: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml",
        site_url: "https://www.espncricinfo.com",
        description: "Cricket news, scores, and analysis",
        icon_url: "https://www.espncricinfo.com/favicon.ico",
        category: "Cricket",
        country: "US",
        language: "en",
        tags: ["cricket", "sports", "scores"],
        popularity_score: 90,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Football Feeds
      {
        id: randomUUID(),
        name: "The Guardian Football",
        url: "https://www.theguardian.com/football/rss",
        site_url: "https://www.theguardian.com/football",
        description: "Football news from The Guardian",
        icon_url: "https://www.theguardian.com/favicon.ico",
        category: "Football",
        country: "UK",
        language: "en",
        tags: ["football", "soccer", "sports"],
        popularity_score: 88,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Tennis Feeds
      {
        id: randomUUID(),
        name: "Tennis.com",
        url: "https://www.tennis.com/rss/news.xml",
        site_url: "https://www.tennis.com",
        description: "Tennis news and tournament coverage",
        icon_url: "https://www.tennis.com/favicon.ico",
        category: "Tennis",
        country: "US",
        language: "en",
        tags: ["tennis", "sports", "tournaments"],
        popularity_score: 82,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Photography Feeds
      {
        id: randomUUID(),
        name: "PetaPixel",
        url: "https://petapixel.com/feed/",
        site_url: "https://petapixel.com",
        description: "Photography news and tutorials",
        icon_url: "https://petapixel.com/favicon.ico",
        category: "Photography",
        country: "US",
        language: "en",
        tags: ["photography", "cameras", "tutorials"],
        popularity_score: 88,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      
      // Interior Design Feeds
      {
        id: randomUUID(),
        name: "Dezeen",
        url: "https://www.dezeen.com/feed/",
        site_url: "https://www.dezeen.com",
        description: "Architecture and design magazine",
        icon_url: "https://www.dezeen.com/favicon.ico",
        category: "Interior",
        country: "UK",
        language: "en",
        tags: ["interior", "design", "architecture"],
        popularity_score: 90,
        article_frequency: "daily",
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    console.log(`📊 Base feeds created: ${this.recommendedFeeds.length} feeds`);
    
    // Note: We no longer generate fake feeds like "Category Feed N"
    // The base feeds above are real RSS feeds that work in production
    // If more feeds are needed, add them to the base feeds array above
    // or ensure the Supabase database is properly seeded
    
    console.log(`📊 Total feeds initialized: ${this.recommendedFeeds.length} feeds`);
    console.log('ℹ️  MemStorage: Using real RSS feeds only (no fake feed generation)');
    
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

  // ============================================================================
  // Embedding Queue Management (Requirements: 1.2, 7.1)
  // ============================================================================
  
  private embeddingQueue: Map<string, {
    id: string;
    article_id: string;
    priority: number;
    attempts: number;
    max_attempts: number;
    last_attempt_at: Date | null;
    error_message: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
  }> = new Map();

  async addToEmbeddingQueue(articleIds: string[], priority: number = 0): Promise<void> {
    for (const articleId of articleIds) {
      // Skip if already in queue
      if (this.embeddingQueue.has(articleId)) {
        continue;
      }
      
      const queueItem = {
        id: randomUUID(),
        article_id: articleId,
        priority,
        attempts: 0,
        max_attempts: 3,
        last_attempt_at: null,
        error_message: null,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      this.embeddingQueue.set(articleId, queueItem);
    }
  }

  async getEmbeddingQueueItems(limit: number, status?: string): Promise<Array<{
    id: string;
    article_id: string;
    priority: number;
    attempts: number;
    max_attempts: number;
    last_attempt_at: Date | null;
    error_message: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
  }>> {
    let items = Array.from(this.embeddingQueue.values());
    
    if (status) {
      items = items.filter(item => item.status === status);
    }
    
    // Sort by priority (descending) then by created_at (ascending)
    items.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.created_at.getTime() - b.created_at.getTime();
    });
    
    return items.slice(0, limit);
  }

  async updateEmbeddingQueueItem(id: string, updates: Partial<{
    priority: number;
    attempts: number;
    last_attempt_at: Date | null;
    error_message: string | null;
    status: string;
  }>): Promise<void> {
    // Find item by id
    const entries = Array.from(this.embeddingQueue.entries());
    for (const [articleId, item] of entries) {
      if (item.id === id) {
        this.embeddingQueue.set(articleId, {
          ...item,
          ...updates,
          updated_at: new Date(),
        });
        return;
      }
    }
  }

  async removeFromEmbeddingQueue(articleId: string): Promise<void> {
    this.embeddingQueue.delete(articleId);
  }

  async getEmbeddingQueueCount(status?: string): Promise<number> {
    if (!status) {
      return this.embeddingQueue.size;
    }
    
    let count = 0;
    const values = Array.from(this.embeddingQueue.values());
    for (const item of values) {
      if (item.status === status) {
        count++;
      }
    }
    return count;
  }

  // ============================================================================
  // Article Embedding Management (Requirements: 1.4, 7.3)
  // ============================================================================

  async getArticleById(id: string): Promise<Article | undefined> {
    return this.articles.get(id);
  }

  async updateArticleEmbedding(
    articleId: string,
    embedding: number[],
    contentHash: string,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    const article = this.articles.get(articleId);
    if (!article) {
      throw new Error(`Article with id ${articleId} not found`);
    }
    
    const updatedArticle: Article = {
      ...article,
      embedding: embedding.length > 0 ? JSON.stringify(embedding) : null,
      content_hash: contentHash || null,
      embedding_status: status,
      embedding_generated_at: status === 'completed' ? new Date() : null,
      embedding_error: error || null,
    };
    
    this.articles.set(articleId, updatedArticle);
  }

  // ============================================================================
  // Clustering Storage Management (Requirements: 2.1, 2.2, 2.5, 2.6, 2.7)
  // ============================================================================
  
  private clusters: Map<string, Cluster> = new Map();

  async getArticlesWithEmbeddings(
    userId?: string,
    feedIds?: string[],
    hoursBack: number = 48
  ): Promise<Array<{
    id: string;
    title: string;
    excerpt: string | null;
    feedId: string;
    feedName: string;
    embedding: number[];
    publishedAt: Date | null;
    imageUrl?: string | null;
  }>> {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const result: Array<{
      id: string;
      title: string;
      excerpt: string | null;
      feedId: string;
      feedName: string;
      embedding: number[];
      publishedAt: Date | null;
      imageUrl?: string | null;
    }> = [];
    
    // Get user's feeds if userId is provided
    let userFeedIds: Set<string> | null = null;
    if (userId) {
      const userFeeds = this.userFeeds.get(userId) || [];
      userFeedIds = new Set(userFeeds.map(f => f.id));
    }
    
    // Filter by feedIds if provided
    const feedIdSet = feedIds ? new Set(feedIds) : null;
    
    // Build feed name lookup
    const feedNameMap = new Map<string, string>();
    if (userId) {
      const userFeeds = this.userFeeds.get(userId) || [];
      userFeeds.forEach(f => feedNameMap.set(f.id, f.name));
    }
    
    this.articles.forEach((article) => {
      // Skip if no embedding
      if (!article.embedding) {
        return;
      }
      
      // Filter by user's feeds
      if (userFeedIds && !userFeedIds.has(article.feed_id)) {
        return;
      }
      
      // Filter by specific feedIds
      if (feedIdSet && !feedIdSet.has(article.feed_id)) {
        return;
      }
      
      // Filter by time
      const articleTime = article.published_at || article.fetched_at;
      if (articleTime && articleTime < cutoffTime) {
        return;
      }
      
      // Parse embedding
      let embedding: number[];
      try {
        embedding = JSON.parse(article.embedding);
      } catch {
        return; // Skip if embedding is invalid
      }
      
      result.push({
        id: article.id,
        title: article.title,
        excerpt: article.excerpt,
        feedId: article.feed_id,
        feedName: feedNameMap.get(article.feed_id) || 'Unknown Feed',
        embedding,
        publishedAt: article.published_at,
        imageUrl: article.image_url,
      });
    });
    
    return result;
  }

  async getRecentArticles(
    userId?: string,
    feedIds?: string[],
    hoursBack: number = 168
  ): Promise<Array<{
    id: string;
    title: string;
    excerpt: string | null;
    feedId: string;
    feedName: string;
    publishedAt: Date | null;
  }>> {
    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const result: Array<{
      id: string;
      title: string;
      excerpt: string | null;
      feedId: string;
      feedName: string;
      publishedAt: Date | null;
    }> = [];
    
    // Get user's feeds if userId is provided
    let userFeedIds: Set<string> | null = null;
    if (userId) {
      const userFeeds = this.userFeeds.get(userId) || [];
      userFeedIds = new Set(userFeeds.map(f => f.id));
    }
    
    // Filter by feedIds if provided
    const targetFeedIds = feedIds ? new Set(feedIds) : null;
    
    for (const [feedId, articles] of this.articles) {
      // Skip if not in user's feeds (when userId provided)
      if (userFeedIds && !userFeedIds.has(feedId)) continue;
      
      // Skip if not in target feeds (when feedIds provided)
      if (targetFeedIds && !targetFeedIds.has(feedId)) continue;
      
      const feed = this.feeds.get(feedId);
      if (!feed) continue;
      
      for (const article of articles) {
        if (article.published_at && article.published_at >= cutoffTime) {
          result.push({
            id: article.id,
            title: article.title,
            excerpt: article.excerpt,
            feedId: article.feed_id,
            feedName: feed.name,
            publishedAt: article.published_at
          });
        }
      }
    }
    
    // Sort by published date (newest first) and limit to 1000 for performance
    return result
      .sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0))
      .slice(0, 1000);
  }

  async createCluster(cluster: InsertCluster): Promise<Cluster> {
    const id = randomUUID();
    const newCluster: Cluster = {
      id,
      title: cluster.title,
      summary: cluster.summary || null,
      article_count: cluster.article_count || 0,
      source_feeds: cluster.source_feeds || [],
      timeframe_start: cluster.timeframe_start || null,
      timeframe_end: cluster.timeframe_end || null,
      expires_at: cluster.expires_at || null,
      avg_similarity: cluster.avg_similarity || null,
      relevance_score: cluster.relevance_score || null,
      generation_method: cluster.generation_method || 'vector',
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    this.clusters.set(id, newCluster);
    return newCluster;
  }

  async updateCluster(id: string, updates: Partial<Cluster>): Promise<Cluster> {
    const cluster = this.clusters.get(id);
    if (!cluster) {
      throw new Error(`Cluster with id ${id} not found`);
    }
    
    const updatedCluster: Cluster = {
      ...cluster,
      ...updates,
      updated_at: new Date(),
    };
    
    this.clusters.set(id, updatedCluster);
    return updatedCluster;
  }

  async deleteCluster(id: string): Promise<void> {
    // Remove cluster association from articles
    this.articles.forEach((article, articleId) => {
      if (article.cluster_id === id) {
        this.articles.set(articleId, { ...article, cluster_id: null });
      }
    });
    
    this.clusters.delete(id);
  }

  async getClusterById(id: string): Promise<Cluster | undefined> {
    return this.clusters.get(id);
  }

  async getClusters(options?: { 
    userId?: string; 
    includeExpired?: boolean;
    limit?: number;
  }): Promise<Cluster[]> {
    const now = new Date();
    let clusters = Array.from(this.clusters.values());
    
    // Filter expired clusters unless includeExpired is true
    if (!options?.includeExpired) {
      clusters = clusters.filter(c => !c.expires_at || c.expires_at > now);
    }
    
    // Sort by relevance score descending
    clusters.sort((a, b) => {
      const scoreA = parseFloat(a.relevance_score || '0');
      const scoreB = parseFloat(b.relevance_score || '0');
      return scoreB - scoreA;
    });
    
    // Apply limit
    if (options?.limit) {
      clusters = clusters.slice(0, options.limit);
    }
    
    return clusters;
  }

  async assignArticlesToCluster(articleIds: string[], clusterId: string): Promise<void> {
    for (const articleId of articleIds) {
      const article = this.articles.get(articleId);
      if (article) {
        this.articles.set(articleId, { ...article, cluster_id: clusterId });
      }
    }
    
    // Update cluster article count
    const cluster = this.clusters.get(clusterId);
    if (cluster) {
      this.clusters.set(clusterId, {
        ...cluster,
        article_count: articleIds.length,
        updated_at: new Date(),
      });
    }
  }

  async removeArticlesFromCluster(clusterId: string): Promise<void> {
    this.articles.forEach((article, articleId) => {
      if (article.cluster_id === clusterId) {
        this.articles.set(articleId, { ...article, cluster_id: null });
      }
    });
  }

  async deleteExpiredClusters(): Promise<number> {
    const now = new Date();
    let deletedCount = 0;
    
    const expiredClusterIds: string[] = [];
    this.clusters.forEach((cluster, id) => {
      if (cluster.expires_at && cluster.expires_at <= now) {
        expiredClusterIds.push(id);
      }
    });
    
    for (const id of expiredClusterIds) {
      await this.deleteCluster(id);
      deletedCount++;
    }
    
    return deletedCount;
  }

  async getArticleIdsByClusterId(clusterId: string): Promise<string[]> {
    const articleIds: string[] = [];
    this.articles.forEach((article, id) => {
      if (article.cluster_id === clusterId) {
        articleIds.push(id);
      }
    });
    return articleIds;
  }

  // ============================================================================
  // Feed Scheduler Management (Requirements: 3.1, 3.2, 3.3, 6.2, 6.6)
  // ============================================================================

  async getFeedById(feedId: string): Promise<Feed | undefined> {
    // Search through all user feeds
    for (const feeds of this.userFeeds.values()) {
      const feed = feeds.find(f => f.id === feedId);
      if (feed) {
        return feed;
      }
    }
    return undefined;
  }

  async getAllActiveFeeds(): Promise<Feed[]> {
    const allFeeds: Feed[] = [];
    this.userFeeds.forEach(feeds => {
      allFeeds.push(...feeds.filter(f => f.status === 'active'));
    });
    return allFeeds;
  }

  async getFeedsDueForSync(limit: number = 50): Promise<Feed[]> {
    const now = new Date();
    const dueFeeds: Feed[] = [];
    
    this.userFeeds.forEach(feeds => {
      for (const feed of feeds) {
        if (feed.status !== 'active') continue;
        
        // Feed is due if next_sync_at is null or in the past
        if (!feed.next_sync_at || new Date(feed.next_sync_at) <= now) {
          dueFeeds.push(feed);
        }
      }
    });
    
    // Sort by next_sync_at (null first, then oldest)
    dueFeeds.sort((a, b) => {
      if (!a.next_sync_at) return -1;
      if (!b.next_sync_at) return 1;
      return new Date(a.next_sync_at).getTime() - new Date(b.next_sync_at).getTime();
    });
    
    return dueFeeds.slice(0, limit);
  }

  async updateFeedPriority(feedId: string, priority: FeedPriority): Promise<Feed> {
    // Find and update the feed priority
    for (const [userId, feeds] of this.userFeeds.entries()) {
      const feedIndex = feeds.findIndex(f => f.id === feedId);
      if (feedIndex !== -1) {
        const feed = feeds[feedIndex];
        const updatedFeed: Feed = {
          ...feed,
          priority: priority,
          sync_priority: priority,
          updated_at: new Date(),
        };
        feeds[feedIndex] = updatedFeed;
        this.userFeeds.set(userId, feeds);
        return updatedFeed;
      }
    }
    
    throw new Error(`Feed with id ${feedId} not found`);
  }

  async updateFeedSchedule(feedId: string, updates: {
    sync_priority?: string;
    next_sync_at?: Date;
    sync_interval_hours?: number;
    last_fetched_at?: Date;
  }): Promise<Feed> {
    // Find and update the feed
    for (const [userId, feeds] of this.userFeeds.entries()) {
      const feedIndex = feeds.findIndex(f => f.id === feedId);
      if (feedIndex !== -1) {
        const feed = feeds[feedIndex];
        const updatedFeed: Feed = {
          ...feed,
          sync_priority: updates.sync_priority ?? feed.sync_priority,
          next_sync_at: updates.next_sync_at ?? feed.next_sync_at,
          sync_interval_hours: updates.sync_interval_hours ?? feed.sync_interval_hours,
          last_fetched_at: updates.last_fetched_at ?? feed.last_fetched_at,
          updated_at: new Date(),
        };
        feeds[feedIndex] = updatedFeed;
        this.userFeeds.set(userId, feeds);
        return updatedFeed;
      }
    }
    
    throw new Error(`Feed with id ${feedId} not found`);
  }

  async getNewArticleIds(feedId: string, since: Date): Promise<string[]> {
    const newArticleIds: string[] = [];
    
    this.articles.forEach((article, id) => {
      if (article.feed_id === feedId && article.created_at && article.created_at >= since) {
        newArticleIds.push(id);
      }
    });
    
    return newArticleIds;
  }

  // Feed Health Tracking Methods (MemStorage fallback)
  async getFeedHealthStats(feedId: string, days: number = 7): Promise<{
    feedId: string;
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    lastSyncAt: Date | null;
    lastSyncStatus: 'success' | 'error' | 'in_progress' | null;
    lastError: string | null;
    avgSyncDuration: number;
    totalArticlesFound: number;
    totalArticlesNew: number;
    recentSyncs: Array<{
      id: string;
      status: string;
      startedAt: Date;
      completedAt: Date | null;
      duration: number | null;
      articlesFound: number;
      articlesNew: number;
      error: string | null;
    }>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const syncs = Array.from(this.feedSyncLogs.values())
      .filter(log => log.feed_id === feedId && log.sync_started_at >= since)
      .sort((a, b) => b.sync_started_at.getTime() - a.sync_started_at.getTime());
    
    const successfulSyncs = syncs.filter(s => s.status === 'success').length;
    const failedSyncs = syncs.filter(s => s.status === 'error').length;
    const totalSyncs = syncs.length;
    const lastSync = syncs[0] || null;
    
    const completedSyncs = syncs.filter(s => s.sync_duration_ms != null);
    const avgSyncDuration = completedSyncs.length > 0
      ? completedSyncs.reduce((sum, s) => sum + (s.sync_duration_ms || 0), 0) / completedSyncs.length
      : 0;
    
    const totalArticlesFound = syncs.reduce((sum, s) => sum + (s.articles_found || 0), 0);
    const totalArticlesNew = syncs.reduce((sum, s) => sum + (s.articles_new || 0), 0);
    const lastFailedSync = syncs.find(s => s.status === 'error');
    
    return {
      feedId,
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      successRate: totalSyncs > 0 ? Math.round((successfulSyncs / totalSyncs) * 100) : 0,
      lastSyncAt: lastSync?.sync_started_at || null,
      lastSyncStatus: lastSync?.status as 'success' | 'error' | 'in_progress' | null,
      lastError: lastFailedSync?.error_message || null,
      avgSyncDuration: Math.round(avgSyncDuration),
      totalArticlesFound,
      totalArticlesNew,
      recentSyncs: syncs.slice(0, 10).map(s => ({
        id: s.id,
        status: s.status,
        startedAt: s.sync_started_at,
        completedAt: s.sync_completed_at || null,
        duration: s.sync_duration_ms || null,
        articlesFound: s.articles_found || 0,
        articlesNew: s.articles_new || 0,
        error: s.error_message || null
      }))
    };
  }

  async getAllFeedsHealthStats(userId: string): Promise<Array<{
    feedId: string;
    feedName: string;
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    successRate: number;
    lastSyncAt: Date | null;
    lastSyncStatus: 'success' | 'error' | 'in_progress' | null;
    lastError: string | null;
  }>> {
    const feeds = this.userFeeds.get(userId) || [];
    const since = new Date();
    since.setDate(since.getDate() - 7);
    
    return feeds.map(feed => {
      const syncs = Array.from(this.feedSyncLogs.values())
        .filter(log => log.feed_id === feed.id && log.sync_started_at >= since)
        .sort((a, b) => b.sync_started_at.getTime() - a.sync_started_at.getTime());
      
      const successfulSyncs = syncs.filter(s => s.status === 'success').length;
      const failedSyncs = syncs.filter(s => s.status === 'error').length;
      const totalSyncs = syncs.length;
      const lastSync = syncs[0] || null;
      const lastFailedSync = syncs.find(s => s.status === 'error');
      
      return {
        feedId: feed.id,
        feedName: feed.name,
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        successRate: totalSyncs > 0 ? Math.round((successfulSyncs / totalSyncs) * 100) : 0,
        lastSyncAt: lastSync?.sync_started_at || null,
        lastSyncStatus: lastSync?.status as 'success' | 'error' | 'in_progress' | null,
        lastError: lastFailedSync?.error_message || null
      };
    });
  }

  // AI Rate Limiter Storage Methods (Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6)
  private aiUsageLogs: Map<string, AIUsageLog> = new Map();
  private aiUsageDaily: Map<string, AIUsageDaily> = new Map();
  private deadLetterQueue: Map<string, {
    id: string;
    operation: AIOperation;
    provider: AIProvider;
    userId?: string;
    payload: unknown;
    errorMessage: string;
    attempts: number;
    createdAt: Date;
    lastAttemptAt: Date;
  }> = new Map();

  async recordUsageLog(usage: InsertAIUsageLog): Promise<AIUsageLog> {
    const id = randomUUID();
    const log: AIUsageLog = {
      id,
      user_id: usage.user_id || null,
      operation: usage.operation,
      provider: usage.provider,
      model: usage.model || null,
      token_count: usage.token_count,
      input_tokens: usage.input_tokens || null,
      output_tokens: usage.output_tokens || null,
      estimated_cost: usage.estimated_cost || null,
      success: usage.success ?? true,
      error_message: usage.error_message || null,
      latency_ms: usage.latency_ms || null,
      request_metadata: usage.request_metadata || null,
      created_at: new Date()
    };
    this.aiUsageLogs.set(id, log);
    return log;
  }

  async getDailyUsage(userId: string, date: string): Promise<AIUsageDaily | undefined> {
    return this.aiUsageDaily.get(`${userId}-${date}`);
  }

  async upsertDailyUsage(usage: InsertAIUsageDaily): Promise<AIUsageDaily> {
    const key = `${usage.user_id}-${usage.date}`;
    const existing = this.aiUsageDaily.get(key);
    
    if (existing) {
      const updated: AIUsageDaily = {
        ...existing,
        embeddings_count: usage.embeddings_count ?? existing.embeddings_count,
        clusterings_count: usage.clusterings_count ?? existing.clusterings_count,
        searches_count: usage.searches_count ?? existing.searches_count,
        summaries_count: usage.summaries_count ?? existing.summaries_count,
        total_tokens: usage.total_tokens ?? existing.total_tokens,
        openai_tokens: usage.openai_tokens ?? existing.openai_tokens,
        anthropic_tokens: usage.anthropic_tokens ?? existing.anthropic_tokens,
        estimated_cost: usage.estimated_cost ?? existing.estimated_cost,
        updated_at: new Date()
      };
      this.aiUsageDaily.set(key, updated);
      return updated;
    }
    
    const newUsage: AIUsageDaily = {
      id: randomUUID(),
      user_id: usage.user_id,
      date: usage.date,
      embeddings_count: usage.embeddings_count ?? 0,
      clusterings_count: usage.clusterings_count ?? 0,
      searches_count: usage.searches_count ?? 0,
      summaries_count: usage.summaries_count ?? 0,
      total_tokens: usage.total_tokens ?? 0,
      openai_tokens: usage.openai_tokens ?? 0,
      anthropic_tokens: usage.anthropic_tokens ?? 0,
      estimated_cost: usage.estimated_cost ?? '0',
      embeddings_limit: 500,
      clusterings_limit: 10,
      searches_limit: 100,
      created_at: new Date(),
      updated_at: new Date()
    };
    this.aiUsageDaily.set(key, newUsage);
    return newUsage;
  }

  async incrementDailyUsage(
    userId: string,
    date: string,
    operation: AIOperation,
    tokenCount: number,
    provider: AIProvider,
    cost: number
  ): Promise<AIUsageDaily> {
    const key = `${userId}-${date}`;
    let usage = this.aiUsageDaily.get(key);
    
    if (!usage) {
      usage = {
        id: randomUUID(),
        user_id: userId,
        date,
        embeddings_count: 0,
        clusterings_count: 0,
        searches_count: 0,
        summaries_count: 0,
        total_tokens: 0,
        openai_tokens: 0,
        anthropic_tokens: 0,
        estimated_cost: '0',
        embeddings_limit: 500,
        clusterings_limit: 10,
        searches_limit: 100,
        created_at: new Date(),
        updated_at: new Date()
      };
    }
    
    // Increment operation count
    switch (operation) {
      case 'embedding':
        usage.embeddings_count++;
        break;
      case 'clustering':
        usage.clusterings_count++;
        break;
      case 'search':
        usage.searches_count++;
        break;
      case 'summary':
        usage.summaries_count++;
        break;
    }
    
    // Increment token counts
    usage.total_tokens += tokenCount;
    if (provider === 'openai') {
      usage.openai_tokens += tokenCount;
    } else {
      usage.anthropic_tokens += tokenCount;
    }
    
    // Update cost
    const currentCost = parseFloat(usage.estimated_cost || '0');
    usage.estimated_cost = (currentCost + cost).toFixed(6);
    usage.updated_at = new Date();
    
    this.aiUsageDaily.set(key, usage);
    return usage;
  }

  async getUsageStats(userId: string, days: number = 7): Promise<AIUsageDaily[]> {
    const results: AIUsageDaily[] = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const usage = this.aiUsageDaily.get(`${userId}-${dateStr}`);
      if (usage) {
        results.push(usage);
      }
    }
    
    return results;
  }

  async addToDeadLetterQueue(item: {
    operation: AIOperation;
    provider: AIProvider;
    userId?: string;
    payload: unknown;
    errorMessage: string;
    attempts: number;
    lastAttemptAt: Date;
  }): Promise<void> {
    const id = randomUUID();
    this.deadLetterQueue.set(id, {
      id,
      operation: item.operation,
      provider: item.provider,
      userId: item.userId,
      payload: item.payload,
      errorMessage: item.errorMessage,
      attempts: item.attempts,
      createdAt: new Date(),
      lastAttemptAt: item.lastAttemptAt
    });
  }

  async getDeadLetterItems(limit: number = 100): Promise<Array<{
    id: string;
    operation: AIOperation;
    provider: AIProvider;
    userId?: string;
    payload: unknown;
    errorMessage: string;
    attempts: number;
    createdAt: Date;
    lastAttemptAt: Date;
  }>> {
    const items = Array.from(this.deadLetterQueue.values());
    return items.slice(0, limit);
  }

  async removeFromDeadLetterQueue(id: string): Promise<void> {
    this.deadLetterQueue.delete(id);
  }

  async getArticleCountsByFeed(userId: string): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const userFeeds = this.userFeeds.get(userId) || [];
    
    for (const feed of userFeeds) {
      let count = 0;
      for (const article of this.articles.values()) {
        if (article.feed_id === feed.id) {
          count++;
        }
      }
      result.set(feed.id, count);
    }
    
    return result;
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
  } else if (!url.startsWith('https://') && !url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
    issues.push('SUPABASE_URL does not start with https:// (or local development URL)');
    console.log('❌ SUPABASE_URL protocol is invalid');
  } else if (!url.includes('.supabase.co') && !url.includes('127.0.0.1') && !url.includes('localhost')) {
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
