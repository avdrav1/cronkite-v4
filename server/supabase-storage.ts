import { createClient } from '@supabase/supabase-js';
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
  MAX_FEEDS_PER_USER,
  type EngagementSignal
} from "@shared/schema";
import { categoryMappingService } from "@shared/category-mapping";
import { type IStorage } from "./storage";

export class SupabaseStorage implements IStorage {
  private supabase;
  private connectionValidated: boolean = false;
  private fallbackStorage?: IStorage;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Initialize fallback storage in background (don't block constructor)
    this.initializeFallback().catch(() => {});
    
    // Validate connection in background
    this.validateConnection();
  }

  /**
   * Validates Supabase connection and sets up fallback if needed
   */
  private async validateConnection(): Promise<void> {
    try {
      const connectionPromise = this.supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      // Add timeout to prevent hanging connections
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 10000);
      });
      
      const { error } = await Promise.race([connectionPromise, timeoutPromise]) as any;
      
      if (error) {
        console.warn('⚠️ Supabase connection failed, using fallback');
        this.connectionValidated = false;
        await this.initializeFallback();
      } else {
        this.connectionValidated = true;
      }
    } catch (error) {
      console.warn('⚠️ Supabase connection error, using fallback');
      this.connectionValidated = false;
      await this.initializeFallback();
    }
  }

  /**
   * Initializes MemStorage as fallback when Supabase is unavailable
   */
  private async initializeFallback(): Promise<void> {
    try {
      if (!this.fallbackStorage) {
        const storageModule = await import('./storage');
        this.fallbackStorage = new storageModule.MemStorage();
      }
    } catch (error) {
      console.error('❌ Failed to initialize fallback storage');
    }
  }

  /**
   * Executes operation with automatic fallback to MemStorage if Supabase fails
   */
  private async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    try {
      // If connection was never validated, try to validate it now
      if (!this.connectionValidated) {
        await this.validateConnection();
      }
      
      // Attempt the primary operation
      return await operation();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // If we have a fallback storage and a fallback operation, use it
      if (this.fallbackStorage && fallbackOperation) {
        try {
          return await fallbackOperation();
        } catch (fallbackError) {
          // Re-throw the original error since fallback also failed
          throw error;
        }
      }
      
      // If no fallback available, re-throw the error
      throw error;
    }
  }

  // User Management
  async getUser(id: string): Promise<Profile | undefined> {
    return this.executeWithFallback(
      async () => {
        const { data, error } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          // PGRST116 means no rows found, which is expected for new users
          if (error.code === 'PGRST116') {
            return undefined;
          }
          return undefined;
        }
        
        return data as Profile || undefined;
      },
      async () => {
        if (this.fallbackStorage) {
          return await this.fallbackStorage.getUser(id);
        }
        return undefined;
      },
      'getUser'
    );
  }

  async getUserByEmail(email: string): Promise<Profile | undefined> {
    return this.executeWithFallback(
      async () => {
        const { data, error } = await this.supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .single();
        
        if (error || !data) {
          return undefined;
        }
        
        return data as Profile;
      },
      async () => {
        if (this.fallbackStorage) {
          return await this.fallbackStorage.getUserByEmail(email);
        }
        return undefined;
      },
      'getUserByEmail'
    );
  }

  async createUser(user: InsertProfile): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .insert(user)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create user: ${error.message} (code: ${error.code})`);
    }
    
    if (!data) {
      throw new Error('Failed to create user: No data returned');
    }
    
    return data as Profile;
  }

  async updateUser(id: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to update user: ${error?.message}`);
    }
    
    return data as Profile;
  }

  // Authentication Methods
  async authenticateUser(email: string, password: string): Promise<Profile | null> {
    // Use Supabase Auth for authentication
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error || !data.user) {
      return null;
    }
    
    // Get the user profile
    const profile = await this.getUser(data.user.id);
    return profile || null;
  }

  async createUserWithPassword(user: InsertProfile, password: string): Promise<Profile> {
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: user.display_name
      }
    });
    
    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`);
    }
    
    // Check if profile already exists
    let profile = await this.getUser(authData.user.id);
    
    if (!profile) {
      // Create profile with the auth user ID
      const profileData: InsertProfile = {
        ...user,
        id: authData.user.id
      };
      
      profile = await this.createUser(profileData);
    }
    
    // Create default user settings if they don't exist
    const existingSettings = await this.getUserSettings(profile.id);
    if (!existingSettings) {
      await this.createUserSettings(profile.id);
    }
    
    return profile;
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });
    
    if (error) {
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }

  // User Settings
  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const { data, error } = await this.supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
    return data as UserSettings;
  }

  async createUserSettings(userId: string, settings?: Partial<InsertUserSettings>): Promise<UserSettings> {
    const settingsData: InsertUserSettings = {
      user_id: userId,
      ...settings
    };
    
    const { data, error } = await this.supabase
      .from('user_settings')
      .insert(settingsData)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to create user settings: ${error?.message}`);
    }
    
    return data as UserSettings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    const { data, error } = await this.supabase
      .from('user_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to update user settings: ${error?.message}`);
    }
    
    return data as UserSettings;
  }

  // User Interests Management
  async setUserInterests(userId: string, interests: string[]): Promise<void> {
    // First, delete existing interests for this user
    await this.supabase
      .from('user_interests')
      .delete()
      .eq('user_id', userId);
    
    // Then insert new interests
    if (interests.length > 0) {
      const interestData: InsertUserInterests[] = interests.map(category => ({
        user_id: userId,
        category,
        selected_at: new Date(),
      }));
      
      const { error } = await this.supabase
        .from('user_interests')
        .insert(interestData);
      
      if (error) {
        throw new Error(`Failed to set user interests: ${error.message}`);
      }
    }
  }

  async getUserInterests(userId: string): Promise<UserInterests[]> {
    const { data, error } = await this.supabase
      .from('user_interests')
      .select('*')
      .eq('user_id', userId)
      .order('selected_at', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to get user interests: ${error.message}`);
    }
    
    return (data || []) as UserInterests[];
  }

  // Recommended Feeds Retrieval
  async getRecommendedFeeds(): Promise<RecommendedFeed[]> {
    return this.executeWithFallback(
      async () => {
        const { data, error } = await this.supabase
          .from('recommended_feeds')
          .select('*')
          .order('popularity_score', { ascending: false });
        
        if (error) {
          throw new Error(`Failed to get recommended feeds: ${error.message}`);
        }
        
        const feeds = (data || []) as RecommendedFeed[];
        
        // If empty and we have fallback, trigger it
        if (feeds.length === 0 && this.fallbackStorage) {
          throw new Error('Empty recommended_feeds table - triggering fallback');
        }
        
        return feeds;
      },
      // Fallback operation using MemStorage
      async () => {
        if (this.fallbackStorage) {
          return await this.fallbackStorage.getRecommendedFeeds();
        }
        return [];
      },
      'getRecommendedFeeds'
    );
  }

  // Recommended Feeds Management with Category Validation
  async createRecommendedFeed(insertFeed: InsertRecommendedFeed): Promise<RecommendedFeed> {
    // Validate category using category mapping service
    if (!categoryMappingService.isValidDatabaseCategory(insertFeed.category)) {
      throw new Error(`Invalid category "${insertFeed.category}" - not found in category mapping`);
    }
    
    const { data, error } = await this.supabase
      .from('recommended_feeds')
      .insert(insertFeed)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to create recommended feed: ${error?.message}`);
    }
    
    console.log(`✅ SupabaseStorage: Recommended feed created successfully with valid category "${data.category}"`);
    return data as RecommendedFeed;
  }

  async updateRecommendedFeed(id: string, updates: Partial<RecommendedFeed>): Promise<RecommendedFeed> {
    console.log(`🔍 SupabaseStorage: Updating recommended feed ${id} with category validation...`);
    
    // Validate category if it's being updated
    if (updates.category) {
      if (!categoryMappingService.isValidDatabaseCategory(updates.category)) {
        const errorMsg = `Invalid category "${updates.category}" - not found in category mapping`;
        console.error(`❌ SupabaseStorage: ${errorMsg}`);
        throw new Error(errorMsg);
      }
      console.log(`✅ SupabaseStorage: Category update "${updates.category}" validation passed`);
    }
    
    const { data, error } = await this.supabase
      .from('recommended_feeds')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to update recommended feed: ${error?.message}`);
    }
    
    console.log(`✅ SupabaseStorage: Recommended feed updated successfully with valid category "${data.category}"`);
    return data as RecommendedFeed;
  }

  // User Feed Subscription Management
  async getUserFeeds(userId: string): Promise<Feed[]> {
    return this.executeWithFallback(
      async () => {
        const { data, error } = await this.supabase
          .from('feeds')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        
        if (error) {
          throw new Error(`Failed to get user feeds: ${error.message}`);
        }
        
        return (data || []) as Feed[];
      },
      async () => {
        if (this.fallbackStorage) {
          return await this.fallbackStorage.getUserFeeds(userId);
        }
        return [];
      },
      'getUserFeeds'
    );
  }

  async subscribeToFeeds(userId: string, feedIds: string[]): Promise<void> {
    // Get recommended feeds to create user feeds from
    const { data: recommendedFeeds, error: fetchError } = await this.supabase
      .from('recommended_feeds')
      .select('*')
      .in('id', feedIds);
    
    if (fetchError) {
      throw new Error(`Failed to fetch recommended feeds: ${fetchError.message}`);
    }
    
    if (!recommendedFeeds || recommendedFeeds.length === 0) {
      return; // No feeds to subscribe to
    }
    
    // Create user feeds from recommended feeds
    // Copy category from recommended_feeds to folder_name for sidebar grouping
    const userFeedsData: InsertFeed[] = recommendedFeeds.map(recommendedFeed => ({
      user_id: userId,
      name: recommendedFeed.name,
      url: recommendedFeed.url,
      site_url: recommendedFeed.site_url,
      description: recommendedFeed.description,
      icon_url: recommendedFeed.icon_url,
      folder_name: recommendedFeed.category, // Preserve category for sidebar grouping
      status: "active" as const,
      priority: "medium" as const,
    }));
    
    const { error: insertError } = await this.supabase
      .from('feeds')
      .insert(userFeedsData);
    
    if (insertError) {
      throw new Error(`Failed to subscribe to feeds: ${insertError.message}`);
    }
  }

  async unsubscribeFromFeed(userId: string, feedId: string): Promise<void> {
    const { error } = await this.supabase
      .from('feeds')
      .delete()
      .eq('id', feedId)
      .eq('user_id', userId);
    
    if (error) {
      throw new Error(`Failed to unsubscribe from feed: ${error.message}`);
    }
  }

  // Feed Synchronization Management
  async startFeedSync(feedId: string): Promise<string> {
    const { data, error } = await this.supabase
      .rpc('start_feed_sync', { p_feed_id: feedId });
    
    if (error || !data) {
      throw new Error(`Failed to start feed sync: ${error?.message}`);
    }
    
    return data as string;
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
    const { error } = await this.supabase
      .rpc('complete_feed_sync_success', {
        p_sync_log_id: syncLogId,
        p_http_status_code: stats.httpStatusCode || null,
        p_articles_found: stats.articlesFound || 0,
        p_articles_new: stats.articlesNew || 0,
        p_articles_updated: stats.articlesUpdated || 0,
        p_etag_received: stats.etagReceived || null,
        p_last_modified_received: stats.lastModifiedReceived || null,
        p_feed_size_bytes: stats.feedSizeBytes || null
      });
    
    if (error) {
      throw new Error(`Failed to complete feed sync: ${error.message}`);
    }
  }

  async completeFeedSyncError(syncLogId: string, errorMessage: string, httpStatusCode?: number): Promise<void> {
    const { error } = await this.supabase
      .rpc('complete_feed_sync_error', {
        p_sync_log_id: syncLogId,
        p_error_message: errorMessage,
        p_http_status_code: httpStatusCode || null
      });
    
    if (error) {
      throw new Error(`Failed to complete feed sync with error: ${error.message}`);
    }
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
    // Get user's feeds with names
    const { data: feedsData, error: feedsError } = await this.supabase
      .from('feeds')
      .select('id, name')
      .eq('user_id', userId);
    
    if (feedsError) {
      throw new Error(`Failed to get user feeds: ${feedsError.message}`);
    }
    
    const totalFeeds = feedsData?.length || 0;
    
    if (totalFeeds === 0) {
      return {
        totalFeeds: 0,
        syncing: 0,
        completed: 0,
        failed: 0,
        isActive: false,
        errors: [],
        newArticlesCount: 0
      };
    }
    
    const feedIds = feedsData!.map(feed => feed.id);
    const feedNameMap = new Map(feedsData!.map(feed => [feed.id, feed.name]));
    
    // Get latest sync status for each feed
    const { data: syncData, error: syncError } = await this.supabase
      .from('feed_sync_log')
      .select('feed_id, status, sync_started_at, error_message, articles_new')
      .in('feed_id', feedIds)
      .order('sync_started_at', { ascending: false });
    
    if (syncError) {
      throw new Error(`Failed to get sync status: ${syncError.message}`);
    }
    
    // Get the latest sync for each feed
    const latestSyncsByFeed = new Map<string, any>();
    (syncData || []).forEach(log => {
      if (!latestSyncsByFeed.has(log.feed_id)) {
        latestSyncsByFeed.set(log.feed_id, log);
      }
    });
    
    const latestSyncs = Array.from(latestSyncsByFeed.values());
    const syncing = latestSyncs.filter(log => log.status === "in_progress").length;
    const completed = latestSyncs.filter(log => log.status === "success").length;
    const failed = latestSyncs.filter(log => log.status === "error").length;
    
    const lastSyncAt = latestSyncs.length > 0 
      ? new Date(Math.max(...latestSyncs.map(log => new Date(log.sync_started_at).getTime())))
      : undefined;
    
    // Get errors from failed syncs
    const errors: Array<{ feedId: string; feedName: string; error: string }> = [];
    latestSyncs.filter(log => log.status === "error").forEach(log => {
      errors.push({
        feedId: log.feed_id,
        feedName: feedNameMap.get(log.feed_id) || 'Unknown Feed',
        error: log.error_message || 'Unknown error'
      });
    });
    
    // Get current syncing feed name
    const currentSyncingLog = latestSyncs.find(log => log.status === "in_progress");
    const currentFeed = currentSyncingLog 
      ? feedNameMap.get(currentSyncingLog.feed_id) 
      : undefined;
    
    // Calculate total new articles from successful syncs
    const newArticlesCount = latestSyncs
      .filter(log => log.status === "success")
      .reduce((sum, log) => sum + (log.articles_new || 0), 0);
    
    return {
      totalFeeds,
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
  async createArticle(article: InsertArticle): Promise<Article> {
    const { data, error } = await this.supabase
      .from('articles')
      .insert(article)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to create article: ${error?.message}`);
    }
    
    return data as Article;
  }

  async updateArticle(id: string, updates: Partial<Article>): Promise<Article> {
    const { data, error } = await this.supabase
      .from('articles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to update article: ${error?.message}`);
    }
    
    return data as Article;
  }

  async getArticleByGuid(feedId: string, guid: string): Promise<Article | undefined> {
    const { data, error } = await this.supabase
      .from('articles')
      .select('*')
      .eq('feed_id', feedId)
      .eq('guid', guid)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
    return data as Article;
  }

  async getArticlesByFeedId(feedId: string, limit?: number): Promise<Article[]> {
    let query = this.supabase
      .from('articles')
      .select('*')
      .eq('feed_id', feedId)
      .order('published_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get articles: ${error.message}`);
    }
    
    return (data || []) as Article[];
  }

  // User Article Management
  async getUserArticleState(userId: string, articleId: string): Promise<UserArticle | undefined> {
    const { data, error } = await this.supabase
      .from('user_articles')
      .select('*')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
    return data as UserArticle;
  }

  async createUserArticleState(userArticle: InsertUserArticle): Promise<UserArticle> {
    const { data, error } = await this.supabase
      .from('user_articles')
      .insert(userArticle)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to create user article state: ${error?.message}`);
    }
    
    return data as UserArticle;
  }

  async updateUserArticleState(userId: string, articleId: string, updates: Partial<UserArticle>): Promise<UserArticle> {
    // First try to update existing record
    const { data: updateData, error: updateError } = await this.supabase
      .from('user_articles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .select()
      .single();
    
    if (!updateError && updateData) {
      return updateData as UserArticle;
    }
    
    // If no existing record, create new one
    return this.createUserArticleState({
      user_id: userId,
      article_id: articleId,
      ...updates
    });
  }

  // Feed Count and Limit Management (Requirements: 5.1, 5.2)
  async getUserFeedCount(userId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('feeds')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (error) {
      throw new Error(`Failed to get user feed count: ${error.message}`);
    }
    
    return count || 0;
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
    let query = this.supabase
      .from('user_articles')
      .select(`
        article_id,
        starred_at,
        articles (*)
      `)
      .eq('user_id', userId)
      .eq('is_starred', true)
      .order('starred_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    if (offset) {
      query = query.range(offset, offset + (limit || 10) - 1);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get starred articles: ${error.message}`);
    }
    
    // Extract articles from the joined data
    const articles: Article[] = (data || [])
      .map((item: any) => item.articles)
      .filter((article: any) => article !== null) as Article[];
    
    return articles;
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
    // Build the query for articles
    let articlesQuery = this.supabase
      .from('articles')
      .select('*')
      .order('published_at', { ascending: false });
    
    if (feedId) {
      articlesQuery = articlesQuery.eq('feed_id', feedId);
    }
    
    const { data: articles, error: articlesError } = await articlesQuery;
    
    if (articlesError) {
      throw new Error(`Failed to get articles: ${articlesError.message}`);
    }
    
    if (!articles || articles.length === 0) {
      return [];
    }
    
    // Get user article states for engagement signals
    const articleIds = articles.map(a => a.id);
    const { data: userArticles, error: userArticlesError } = await this.supabase
      .from('user_articles')
      .select('article_id, engagement_signal')
      .eq('user_id', userId)
      .in('article_id', articleIds);
    
    if (userArticlesError) {
      throw new Error(`Failed to get user article states: ${userArticlesError.message}`);
    }
    
    // Create a map of article_id to engagement_signal
    const engagementMap = new Map<string, string | null>();
    (userArticles || []).forEach((ua: any) => {
      engagementMap.set(ua.article_id, ua.engagement_signal);
    });
    
    // Combine articles with engagement signals
    const result: Array<Article & { engagement?: string }> = articles.map((article: any) => ({
      ...article,
      engagement: engagementMap.get(article.id) || undefined
    }));
    
    return result;
  }
}