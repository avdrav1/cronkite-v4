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
  type InsertAIUsageLog,
  type InsertAIUsageDaily,
  type FeedPriority,
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

  // Get distinct categories with feed counts from recommended_feeds
  async getCategories(): Promise<Array<{ category: string; feedCount: number }>> {
    const { data, error } = await this.supabase
      .from('recommended_feeds')
      .select('category');
    
    if (error) {
      throw new Error(`Failed to get categories: ${error.message}`);
    }
    
    // Count feeds per category
    const categoryCounts = new Map<string, number>();
    for (const feed of data || []) {
      const count = categoryCounts.get(feed.category) || 0;
      categoryCounts.set(feed.category, count + 1);
    }
    
    // Convert to array and sort by feed count descending
    return Array.from(categoryCounts.entries())
      .map(([category, feedCount]) => ({ category, feedCount }))
      .sort((a, b) => b.feedCount - a.feedCount);
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
    console.log(`🔍 SupabaseStorage: Creating custom feed for user ${feed.createdBy}...`);
    
    // Check if feed with this URL already exists
    const existingFeed = await this.getRecommendedFeedByUrl(feed.url);
    if (existingFeed) {
      console.log(`⚠️  SupabaseStorage: Feed with URL ${feed.url} already exists, returning existing feed`);
      return existingFeed;
    }
    
    // Use 'Custom' as default category for custom feeds
    const category = feed.category || 'Custom';
    
    const insertData = {
      name: feed.name,
      url: feed.url,
      site_url: feed.siteUrl || null,
      description: feed.description || null,
      icon_url: feed.iconUrl || null,
      category,
      country: null,
      language: 'en',
      tags: ['custom'],
      popularity_score: 0,
      article_frequency: null,
      is_featured: false
    };
    
    const { data, error } = await this.supabase
      .from('recommended_feeds')
      .insert(insertData)
      .select()
      .single();
    
    if (error || !data) {
      // Check for duplicate key error
      if (error?.code === '23505') {
        console.log(`⚠️  SupabaseStorage: Feed URL already exists (race condition), fetching existing feed`);
        const existing = await this.getRecommendedFeedByUrl(feed.url);
        if (existing) return existing;
      }
      throw new Error(`Failed to create custom feed: ${error?.message}`);
    }
    
    console.log(`✅ SupabaseStorage: Custom feed created successfully: ${data.name} (${data.id})`);
    return data as RecommendedFeed;
  }

  async getRecommendedFeedByUrl(url: string): Promise<RecommendedFeed | undefined> {
    const { data, error } = await this.supabase
      .from('recommended_feeds')
      .select('*')
      .eq('url', url)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
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
    
    // Get existing user feeds to avoid duplicates
    const { data: existingFeeds } = await this.supabase
      .from('feeds')
      .select('url')
      .eq('user_id', userId);
    
    const existingUrls = new Set((existingFeeds || []).map(f => f.url));
    
    // Filter out feeds the user already has
    const newFeeds = recommendedFeeds.filter(rf => !existingUrls.has(rf.url));
    
    if (newFeeds.length === 0) {
      console.log('All requested feeds already subscribed');
      return; // All feeds already subscribed
    }
    
    // Helper to create minimal feed data (only core columns that always exist)
    const createMinimalFeedData = (recommendedFeed: any) => ({
      user_id: userId,
      name: recommendedFeed.name,
      url: recommendedFeed.url,
      site_url: recommendedFeed.site_url,
      description: recommendedFeed.description,
      icon_url: recommendedFeed.icon_url,
      status: "active" as const,
      priority: "medium" as "high" | "medium" | "low",
    });
    
    // Try with all columns first, then fall back progressively
    // Attempt 1: Full data with scheduling columns and folder_name
    try {
      const { getSyncIntervalHours, calculateNextSyncAt, isValidPriority } = await import('./feed-scheduler');
      
      const fullFeedsData = newFeeds.map(recommendedFeed => {
        const inheritedPriority = recommendedFeed.default_priority || 'medium';
        const priority = isValidPriority(inheritedPriority) ? inheritedPriority : 'medium';
        const syncIntervalHours = getSyncIntervalHours(priority);
        const nextSyncAt = calculateNextSyncAt(priority, null);
        
        return {
          ...createMinimalFeedData(recommendedFeed),
          folder_name: recommendedFeed.category,
          priority: priority as "high" | "medium" | "low",
          sync_priority: priority,
          sync_interval_hours: syncIntervalHours,
          next_sync_at: nextSyncAt,
        };
      });
      
      const { error: fullError } = await this.supabase
        .from('feeds')
        .insert(fullFeedsData);
      
      if (!fullError) {
        console.log(`✅ Subscribed to ${newFeeds.length} feeds with full scheduling`);
        return;
      }
      
      // Check for missing column errors
      const errorMsg = fullError.message.toLowerCase();
      const isMissingColumn = fullError.code === '42703' || 
        errorMsg.includes('column') || 
        errorMsg.includes('schema cache') ||
        errorMsg.includes('next_sync_at') ||
        errorMsg.includes('sync_priority') ||
        errorMsg.includes('sync_interval') ||
        errorMsg.includes('folder_name');
      
      if (!isMissingColumn) {
        // Check for duplicate key violation
        if (fullError.code === '23505') {
          console.warn('⚠️ Some feeds already exist, this is expected');
          return;
        }
        throw new Error(`Failed to subscribe to feeds: ${fullError.message}`);
      }
      
      console.warn('⚠️ Some columns missing, trying without scheduling columns...');
      
      // Attempt 2: Without scheduling columns but with folder_name
      const feedsWithFolder = newFeeds.map(recommendedFeed => ({
        ...createMinimalFeedData(recommendedFeed),
        folder_name: recommendedFeed.category,
      }));
      
      const { error: folderError } = await this.supabase
        .from('feeds')
        .insert(feedsWithFolder);
      
      if (!folderError) {
        console.log(`✅ Subscribed to ${newFeeds.length} feeds (without scheduling)`);
        return;
      }
      
      const folderErrorMsg = folderError.message.toLowerCase();
      const isFolderMissing = folderError.code === '42703' || 
        folderErrorMsg.includes('folder_name') ||
        folderErrorMsg.includes('schema cache');
      
      if (!isFolderMissing) {
        if (folderError.code === '23505') {
          console.warn('⚠️ Some feeds already exist, this is expected');
          return;
        }
        throw new Error(`Failed to subscribe to feeds: ${folderError.message}`);
      }
      
      console.warn('⚠️ folder_name column missing, trying minimal insert...');
      
      // Attempt 3: Minimal data only (core columns)
      const minimalFeeds = newFeeds.map(createMinimalFeedData);
      
      const { error: minimalError } = await this.supabase
        .from('feeds')
        .insert(minimalFeeds);
      
      if (minimalError) {
        if (minimalError.code === '23505') {
          console.warn('⚠️ Some feeds already exist, this is expected');
          return;
        }
        throw new Error(`Failed to subscribe to feeds: ${minimalError.message}`);
      }
      
      console.log(`✅ Subscribed to ${newFeeds.length} feeds (minimal mode)`);
      
    } catch (importError) {
      // If feed-scheduler import fails, use minimal insert
      console.warn('⚠️ Could not import feed-scheduler, using minimal insert');
      
      const minimalFeeds = newFeeds.map(createMinimalFeedData);
      
      const { error: minimalError } = await this.supabase
        .from('feeds')
        .insert(minimalFeeds);
      
      if (minimalError) {
        if (minimalError.code === '23505') {
          console.warn('⚠️ Some feeds already exist, this is expected');
          return;
        }
        throw new Error(`Failed to subscribe to feeds: ${minimalError.message}`);
      }
      
      console.log(`✅ Subscribed to ${newFeeds.length} feeds (minimal fallback)`);
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
    // Select all columns EXCEPT embedding to reduce response size
    // Embedding vectors are 1536-dimensional floats (~6KB each) and not needed for article display
    const articleColumnsWithoutEmbedding = `
      id, feed_id, guid, title, url, author, excerpt, content, image_url,
      published_at, fetched_at, ai_summary, ai_summary_generated_at, cluster_id,
      embedding_status, embedding_generated_at, embedding_error, content_hash, created_at
    `;
    
    let query = this.supabase
      .from('articles')
      .select(articleColumnsWithoutEmbedding)
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

  async getUserArticleStates(userId: string, articleIds: string[]): Promise<Map<string, UserArticle>> {
    const result = new Map<string, UserArticle>();
    
    if (articleIds.length === 0) {
      return result;
    }
    
    console.log('📖 getUserArticleStates called:', { userId, articleIdsCount: articleIds.length });
    
    const { data, error } = await this.supabase
      .from('user_articles')
      .select('*')
      .eq('user_id', userId)
      .in('article_id', articleIds);
    
    if (error) {
      console.error('Failed to get user article states:', error);
      return result;
    }
    
    console.log('📖 getUserArticleStates result:', { 
      recordsFound: data?.length || 0,
      readArticles: data?.filter(d => d.is_read).length || 0,
      starredArticles: data?.filter(d => d.is_starred).length || 0
    });
    
    if (data) {
      for (const state of data) {
        result.set(state.article_id, state as UserArticle);
      }
    }
    
    return result;
  }

  async createUserArticleState(userArticle: InsertUserArticle): Promise<UserArticle> {
    console.log('📖 createUserArticleState called:', userArticle);
    
    // First, try to get existing record
    const { data: existing } = await this.supabase
      .from('user_articles')
      .select('*')
      .eq('user_id', userArticle.user_id)
      .eq('article_id', userArticle.article_id)
      .single();
    
    if (existing) {
      // Update existing record
      console.log('📖 Found existing record, updating...');
      const { data, error } = await this.supabase
        .from('user_articles')
        .update({ 
          ...userArticle, 
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', userArticle.user_id)
        .eq('article_id', userArticle.article_id)
        .select()
        .single();
      
      if (error) {
        console.error('📖 Update error:', error.message, error.code);
        throw new Error(`Failed to update user article state: ${error.message}`);
      }
      
      console.log('📖 Update succeeded:', data);
      return data as UserArticle;
    }
    
    // Insert new record
    console.log('📖 No existing record, inserting...');
    const { data, error } = await this.supabase
      .from('user_articles')
      .insert(userArticle)
      .select()
      .single();
    
    console.log('📖 Insert result:', { data, error: error?.message, errorCode: error?.code });
    
    if (!error && data) {
      return data as UserArticle;
    }
    
    // Check if error is due to missing columns (engagement_signal, engagement_signal_at)
    const errorMsg = error?.message?.toLowerCase() || '';
    const isMissingColumn = error?.code === '42703' || 
      errorMsg.includes('column') || 
      errorMsg.includes('schema cache') ||
      errorMsg.includes('engagement_signal');
    
    if (isMissingColumn) {
      console.warn('⚠️ Some columns missing in user_articles, trying without engagement columns...');
      
      // Remove engagement columns and retry
      const { engagement_signal, engagement_signal_at, ...minimalUserArticle } = userArticle as any;
      
      const { data: retryData, error: retryError } = await this.supabase
        .from('user_articles')
        .insert(minimalUserArticle)
        .select()
        .single();
      
      if (retryError || !retryData) {
        throw new Error(`Failed to create user article state: ${retryError?.message}`);
      }
      
      // Return with null engagement fields for compatibility
      return {
        ...retryData,
        engagement_signal: null,
        engagement_signal_at: null
      } as UserArticle;
    }
    
    // Handle duplicate key error - record was created between our check and insert
    if (error?.code === '23505') {
      console.log('📖 Duplicate key - fetching existing record...');
      const { data: existingData } = await this.supabase
        .from('user_articles')
        .select('*')
        .eq('user_id', userArticle.user_id)
        .eq('article_id', userArticle.article_id)
        .single();
      
      if (existingData) {
        // Update the existing record with our values
        const { data: updateData, error: updateError } = await this.supabase
          .from('user_articles')
          .update({ ...userArticle, updated_at: new Date().toISOString() })
          .eq('user_id', userArticle.user_id)
          .eq('article_id', userArticle.article_id)
          .select()
          .single();
        
        if (!updateError && updateData) {
          return updateData as UserArticle;
        }
      }
    }
    
    throw new Error(`Failed to create user article state: ${error?.message}`);
  }

  async updateUserArticleState(userId: string, articleId: string, updates: Partial<UserArticle>): Promise<UserArticle> {
    console.log('📖 updateUserArticleState called:', { userId, articleId, updates });
    
    // First check if record exists
    const { data: existing, error: checkError } = await this.supabase
      .from('user_articles')
      .select('*')
      .eq('user_id', userId)
      .eq('article_id', articleId)
      .single();
    
    console.log('📖 Existing record check:', { exists: !!existing, error: checkError?.code });
    
    if (existing) {
      // Update existing record
      console.log('📖 Updating existing record...');
      const { data: updateData, error: updateError } = await this.supabase
        .from('user_articles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('article_id', articleId)
        .select()
        .single();
      
      if (updateError) {
        // Check if error is due to missing columns
        const errorMsg = updateError.message?.toLowerCase() || '';
        const isMissingColumn = updateError.code === '42703' || 
          errorMsg.includes('column') || 
          errorMsg.includes('schema cache') ||
          errorMsg.includes('engagement_signal');
        
        if (isMissingColumn) {
          console.warn('⚠️ Some columns missing, trying without engagement columns...');
          const { engagement_signal, engagement_signal_at, ...minimalUpdates } = updates as any;
          
          const { data: retryData, error: retryError } = await this.supabase
            .from('user_articles')
            .update({ ...minimalUpdates, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('article_id', articleId)
            .select()
            .single();
          
          if (retryError) {
            throw new Error(`Failed to update user article state: ${retryError.message}`);
          }
          
          return {
            ...retryData,
            engagement_signal: null,
            engagement_signal_at: null
          } as UserArticle;
        }
        
        throw new Error(`Failed to update user article state: ${updateError.message}`);
      }
      
      console.log('📖 Update succeeded:', updateData);
      return updateData as UserArticle;
    }
    
    // No existing record - create new one
    console.log('📖 No existing record, creating new one...');
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
  async getStarredArticles(userId: string, limit?: number, offset?: number): Promise<Array<Article & { is_read?: boolean; is_starred?: boolean; engagement_signal?: string | null }>> {
    console.log('⭐ SupabaseStorage.getStarredArticles called:', { userId, limit, offset });
    
    // Select all article columns EXCEPT embedding to reduce response size
    // Also include user article state fields
    let query = this.supabase
      .from('user_articles')
      .select(`
        article_id,
        is_read,
        is_starred,
        starred_at,
        engagement_signal,
        articles (
          id, feed_id, guid, title, url, author, excerpt, content, image_url,
          published_at, fetched_at, ai_summary, ai_summary_generated_at, cluster_id,
          embedding_status, embedding_generated_at, embedding_error, content_hash, created_at
        )
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
      console.error('⭐ getStarredArticles error:', error.message);
      throw new Error(`Failed to get starred articles: ${error.message}`);
    }
    
    console.log('⭐ getStarredArticles raw data:', data?.length || 0, 'records');
    
    // Extract articles from the joined data and include user state
    const articles = (data || [])
      .map((item: any) => ({
        ...item.articles,
        is_read: item.is_read || false,
        is_starred: item.is_starred || true, // These are starred articles
        engagement_signal: item.engagement_signal || null
      }))
      .filter((article: any) => article !== null && article.id);
    
    console.log('⭐ getStarredArticles returning:', articles.length, 'articles');
    
    return articles;
  }

  // Get Read Articles (Requirements: 6.1, 6.2)
  async getReadArticles(userId: string, limit?: number, offset?: number): Promise<Array<Article & { is_read?: boolean; is_starred?: boolean; engagement_signal?: string | null }>> {
    console.log('📖 SupabaseStorage.getReadArticles called:', { userId, limit, offset });
    
    // Select all article columns EXCEPT embedding to reduce response size
    // Also include user article state fields
    let query = this.supabase
      .from('user_articles')
      .select(`
        article_id,
        is_read,
        is_starred,
        read_at,
        engagement_signal,
        articles (
          id, feed_id, guid, title, url, author, excerpt, content, image_url,
          published_at, fetched_at, ai_summary, ai_summary_generated_at, cluster_id,
          embedding_status, embedding_generated_at, embedding_error, content_hash, created_at
        )
      `)
      .eq('user_id', userId)
      .eq('is_read', true)
      .order('read_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    if (offset) {
      query = query.range(offset, offset + (limit || 10) - 1);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('📖 getReadArticles error:', error.message);
      throw new Error(`Failed to get read articles: ${error.message}`);
    }
    
    console.log('📖 getReadArticles raw data:', data?.length || 0, 'records');
    
    // Extract articles from the joined data and include user state
    const articles = (data || [])
      .map((item: any) => ({
        ...item.articles,
        is_read: item.is_read || true, // These are read articles
        is_starred: item.is_starred || false,
        engagement_signal: item.engagement_signal || null
      }))
      .filter((article: any) => article !== null && article.id);
    
    console.log('📖 getReadArticles returning:', articles.length, 'articles');
    
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
    // Select all columns EXCEPT embedding to reduce response size
    const articleColumnsWithoutEmbedding = `
      id, feed_id, guid, title, url, author, excerpt, content, image_url,
      published_at, fetched_at, ai_summary, ai_summary_generated_at, cluster_id,
      embedding_status, embedding_generated_at, embedding_error, content_hash, created_at
    `;
    
    // Build the query for articles
    let articlesQuery = this.supabase
      .from('articles')
      .select(articleColumnsWithoutEmbedding)
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

  // ============================================================================
  // Embedding Queue Management (Requirements: 1.2, 7.1)
  // ============================================================================

  async addToEmbeddingQueue(articleIds: string[], priority: number = 0): Promise<void> {
    if (articleIds.length === 0) {
      return;
    }
    
    const queueItems = articleIds.map(articleId => ({
      article_id: articleId,
      priority,
      attempts: 0,
      max_attempts: 3,
      status: 'pending',
    }));
    
    // Use upsert to avoid duplicates
    const { error } = await this.supabase
      .from('embedding_queue')
      .upsert(queueItems, { 
        onConflict: 'article_id',
        ignoreDuplicates: true 
      });
    
    if (error) {
      // If upsert fails, try insert with conflict handling
      console.warn(`⚠️ Embedding queue upsert failed: ${error.message}, trying insert...`);
      for (const item of queueItems) {
        try {
          await this.supabase
            .from('embedding_queue')
            .insert(item);
        } catch (insertError) {
          // Ignore duplicate key errors
          console.warn(`⚠️ Could not add article ${item.article_id} to queue (may already exist)`);
        }
      }
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
    let query = this.supabase
      .from('embedding_queue')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get embedding queue items: ${error.message}`);
    }
    
    return (data || []).map((item: any) => ({
      id: item.id,
      article_id: item.article_id,
      priority: item.priority,
      attempts: item.attempts,
      max_attempts: item.max_attempts,
      last_attempt_at: item.last_attempt_at ? new Date(item.last_attempt_at) : null,
      error_message: item.error_message,
      status: item.status,
      created_at: new Date(item.created_at),
      updated_at: new Date(item.updated_at),
    }));
  }

  async updateEmbeddingQueueItem(id: string, updates: Partial<{
    priority: number;
    attempts: number;
    last_attempt_at: Date | null;
    error_message: string | null;
    status: string;
  }>): Promise<void> {
    const { error } = await this.supabase
      .from('embedding_queue')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to update embedding queue item: ${error.message}`);
    }
  }

  async removeFromEmbeddingQueue(articleId: string): Promise<void> {
    const { error } = await this.supabase
      .from('embedding_queue')
      .delete()
      .eq('article_id', articleId);
    
    if (error) {
      throw new Error(`Failed to remove from embedding queue: ${error.message}`);
    }
  }

  async getEmbeddingQueueCount(status?: string): Promise<number> {
    let query = this.supabase
      .from('embedding_queue')
      .select('*', { count: 'exact', head: true });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { count, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get embedding queue count: ${error.message}`);
    }
    
    return count || 0;
  }

  // ============================================================================
  // Article Embedding Management (Requirements: 1.4, 7.3)
  // ============================================================================

  async getArticleById(id: string): Promise<Article | undefined> {
    // Select all columns EXCEPT embedding to reduce response size
    // Embedding vectors are 1536-dimensional floats (~6KB each) and not needed for article display
    const articleColumnsWithoutEmbedding = `
      id, feed_id, guid, title, url, author, excerpt, content, image_url,
      published_at, fetched_at, ai_summary, ai_summary_generated_at, cluster_id,
      embedding_status, embedding_generated_at, embedding_error, content_hash, created_at
    `;
    
    const { data, error } = await this.supabase
      .from('articles')
      .select(articleColumnsWithoutEmbedding)
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
    return data as Article;
  }

  async updateArticleEmbedding(
    articleId: string,
    embedding: number[],
    contentHash: string,
    status: 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    const updates: Record<string, any> = {
      embedding_status: status,
      content_hash: contentHash || null,
      embedding_error: error || null,
    };
    
    if (status === 'completed' && embedding.length > 0) {
      // Store embedding as JSON string (will be converted to vector by database)
      updates.embedding = JSON.stringify(embedding);
      updates.embedding_generated_at = new Date().toISOString();
    }
    
    const { error: updateError } = await this.supabase
      .from('articles')
      .update(updates)
      .eq('id', articleId);
    
    if (updateError) {
      throw new Error(`Failed to update article embedding: ${updateError.message}`);
    }
  }

  // ============================================================================
  // Clustering Storage Management (Requirements: 2.1, 2.2, 2.5, 2.6, 2.7)
  // ============================================================================

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
    
    // Build query for articles with embeddings
    let query = this.supabase
      .from('articles')
      .select(`
        id,
        title,
        excerpt,
        feed_id,
        embedding,
        published_at,
        image_url,
        feeds!inner (
          id,
          name,
          user_id
        )
      `)
      .not('embedding', 'is', null)
      .gte('published_at', cutoffTime.toISOString());
    
    // Filter by user's feeds if userId provided
    if (userId) {
      query = query.eq('feeds.user_id', userId);
    }
    
    // Filter by specific feedIds if provided
    if (feedIds && feedIds.length > 0) {
      query = query.in('feed_id', feedIds);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get articles with embeddings: ${error.message}`);
    }
    
    return (data || []).map((article: any) => {
      // Parse embedding from JSON string or array
      let embedding: number[];
      try {
        if (typeof article.embedding === 'string') {
          embedding = JSON.parse(article.embedding);
        } else if (Array.isArray(article.embedding)) {
          embedding = article.embedding;
        } else {
          embedding = [];
        }
      } catch {
        embedding = [];
      }
      
      return {
        id: article.id,
        title: article.title,
        excerpt: article.excerpt,
        feedId: article.feed_id,
        feedName: article.feeds?.name || 'Unknown Feed',
        embedding,
        publishedAt: article.published_at ? new Date(article.published_at) : null,
        imageUrl: article.image_url,
      };
    }).filter((a: any) => a.embedding.length > 0);
  }

  async createCluster(cluster: InsertCluster): Promise<Cluster> {
    const { data, error } = await this.supabase
      .from('clusters')
      .insert(cluster)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to create cluster: ${error?.message}`);
    }
    
    return data as Cluster;
  }

  async updateCluster(id: string, updates: Partial<Cluster>): Promise<Cluster> {
    const { data, error } = await this.supabase
      .from('clusters')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to update cluster: ${error?.message}`);
    }
    
    return data as Cluster;
  }

  async deleteCluster(id: string): Promise<void> {
    // First, remove cluster association from articles
    await this.supabase
      .from('articles')
      .update({ cluster_id: null })
      .eq('cluster_id', id);
    
    // Then delete the cluster
    const { error } = await this.supabase
      .from('clusters')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw new Error(`Failed to delete cluster: ${error.message}`);
    }
  }

  async getClusterById(id: string): Promise<Cluster | undefined> {
    const { data, error } = await this.supabase
      .from('clusters')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
    return data as Cluster;
  }

  async getClusters(options?: { 
    userId?: string; 
    includeExpired?: boolean;
    limit?: number;
  }): Promise<Cluster[]> {
    try {
      console.log(`📊 getClusters called with options:`, JSON.stringify(options));
      console.log(`📊 Supabase client available: ${!!this.supabase}`);
      
      // Try ordering by relevance_score first (may not exist in older schemas)
      let query = this.supabase
        .from('clusters')
        .select('*');
      
      // Filter expired clusters unless includeExpired is true
      if (!options?.includeExpired) {
        const now = new Date().toISOString();
        console.log(`📊 Filtering clusters with expires_at > ${now}`);
        query = query.or(`expires_at.is.null,expires_at.gt.${now}`);
      }
      
      // Apply limit
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      // Try to order by relevance_score, fall back to created_at if column doesn't exist
      query = query.order('created_at', { ascending: false });
      
      console.log(`📊 Executing getClusters query...`);
      const { data, error } = await query;
      
      if (error) {
        console.error('📊 getClusters error:', error.message, 'code:', error.code);
        // If the error is about missing column, return empty array
        if (error.message.includes('column') || error.message.includes('does not exist')) {
          console.warn('⚠️ Clusters table may be missing columns - returning empty array');
          return [];
        }
        throw new Error(`Failed to get clusters: ${error.message}`);
      }
      
      console.log(`📊 getClusters found ${data?.length || 0} clusters`);
      if (data && data.length > 0) {
        console.log(`📊 First cluster: ${data[0].title}`);
      }
      
      // Sort by relevance_score in memory if the column exists
      const clusters = (data || []) as Cluster[];
      return clusters.sort((a, b) => {
        const scoreA = parseFloat(a.relevance_score || '0');
        const scoreB = parseFloat(b.relevance_score || '0');
        return scoreB - scoreA;
      });
    } catch (error) {
      console.error('📊 getClusters exception:', error instanceof Error ? error.message : error);
      console.error('📊 getClusters stack:', error instanceof Error ? error.stack : 'no stack');
      return [];
    }
  }

  async assignArticlesToCluster(articleIds: string[], clusterId: string): Promise<void> {
    if (articleIds.length === 0) {
      return;
    }
    
    const { error } = await this.supabase
      .from('articles')
      .update({ cluster_id: clusterId })
      .in('id', articleIds);
    
    if (error) {
      throw new Error(`Failed to assign articles to cluster: ${error.message}`);
    }
  }

  async removeArticlesFromCluster(clusterId: string): Promise<void> {
    const { error } = await this.supabase
      .from('articles')
      .update({ cluster_id: null })
      .eq('cluster_id', clusterId);
    
    if (error) {
      throw new Error(`Failed to remove articles from cluster: ${error.message}`);
    }
  }

  async deleteExpiredClusters(): Promise<number> {
    const now = new Date().toISOString();
    
    // Get expired cluster IDs first
    const { data: expiredClusters, error: selectError } = await this.supabase
      .from('clusters')
      .select('id')
      .lt('expires_at', now);
    
    if (selectError) {
      throw new Error(`Failed to find expired clusters: ${selectError.message}`);
    }
    
    if (!expiredClusters || expiredClusters.length === 0) {
      return 0;
    }
    
    const expiredIds = expiredClusters.map(c => c.id);
    
    // Remove cluster associations from articles
    await this.supabase
      .from('articles')
      .update({ cluster_id: null })
      .in('cluster_id', expiredIds);
    
    // Delete expired clusters
    const { error: deleteError } = await this.supabase
      .from('clusters')
      .delete()
      .in('id', expiredIds);
    
    if (deleteError) {
      throw new Error(`Failed to delete expired clusters: ${deleteError.message}`);
    }
    
    return expiredIds.length;
  }

  async getArticleIdsByClusterId(clusterId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('articles')
      .select('id')
      .eq('cluster_id', clusterId);
    
    if (error) {
      console.error(`Failed to get article IDs for cluster ${clusterId}:`, error.message);
      return [];
    }
    
    return (data || []).map(a => a.id);
  }

  // ============================================================================
  // Feed Scheduler Management (Requirements: 3.1, 3.2, 3.3, 6.2, 6.6)
  // ============================================================================

  async getFeedById(feedId: string): Promise<Feed | undefined> {
    const { data, error } = await this.supabase
      .from('feeds')
      .select('*')
      .eq('id', feedId)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
    return data as Feed;
  }

  async getAllActiveFeeds(): Promise<Feed[]> {
    const { data, error } = await this.supabase
      .from('feeds')
      .select('*')
      .eq('status', 'active')
      .order('next_sync_at', { ascending: true, nullsFirst: true });
    
    if (error) {
      throw new Error(`Failed to get active feeds: ${error.message}`);
    }
    
    return (data || []) as Feed[];
  }

  async getFeedsDueForSync(limit: number = 50): Promise<Feed[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await this.supabase
      .from('feeds')
      .select('*')
      .eq('status', 'active')
      .or(`next_sync_at.is.null,next_sync_at.lte.${now}`)
      .order('next_sync_at', { ascending: true, nullsFirst: true })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to get feeds due for sync: ${error.message}`);
    }
    
    return (data || []) as Feed[];
  }

  async updateFeedPriority(feedId: string, priority: FeedPriority): Promise<Feed> {
    const { data, error } = await this.supabase
      .from('feeds')
      .update({
        priority: priority,
        sync_priority: priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', feedId)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to update feed priority: ${error?.message}`);
    }
    
    return data as Feed;
  }

  async updateFeedSchedule(feedId: string, updates: {
    sync_priority?: string;
    next_sync_at?: Date;
    sync_interval_hours?: number;
    last_fetched_at?: Date;
  }): Promise<Feed> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    
    if (updates.sync_priority !== undefined) {
      updateData.sync_priority = updates.sync_priority;
    }
    if (updates.next_sync_at !== undefined) {
      updateData.next_sync_at = updates.next_sync_at.toISOString();
    }
    if (updates.sync_interval_hours !== undefined) {
      updateData.sync_interval_hours = updates.sync_interval_hours;
    }
    if (updates.last_fetched_at !== undefined) {
      updateData.last_fetched_at = updates.last_fetched_at.toISOString();
    }
    
    const { data, error } = await this.supabase
      .from('feeds')
      .update(updateData)
      .eq('id', feedId)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to update feed schedule: ${error?.message}`);
    }
    
    return data as Feed;
  }

  async getNewArticleIds(feedId: string, since: Date): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('articles')
      .select('id')
      .eq('feed_id', feedId)
      .gte('created_at', since.toISOString());
    
    if (error) {
      throw new Error(`Failed to get new article IDs: ${error.message}`);
    }
    
    return (data || []).map((a: any) => a.id);
  }

  // AI Rate Limiter Storage Methods (Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6)
  
  async recordUsageLog(usage: InsertAIUsageLog): Promise<any> {
    const { data, error } = await this.supabase
      .from('ai_usage_log')
      .insert({
        user_id: usage.user_id || null,
        operation: usage.operation,
        provider: usage.provider,
        model: usage.model || null,
        token_count: usage.token_count || 0,
        input_tokens: usage.input_tokens || null,
        output_tokens: usage.output_tokens || null,
        estimated_cost: usage.estimated_cost || null,
        success: usage.success ?? true,
        error_message: usage.error_message || null,
        latency_ms: usage.latency_ms || null,
        request_metadata: usage.request_metadata || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to record usage log:', error);
      throw new Error(`Failed to record usage log: ${error.message}`);
    }
    
    return data;
  }

  async getDailyUsage(userId: string, date: string): Promise<any | undefined> {
    const { data, error } = await this.supabase
      .from('ai_usage_daily')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Failed to get daily usage:', error);
      throw new Error(`Failed to get daily usage: ${error.message}`);
    }
    
    return data || undefined;
  }

  async upsertDailyUsage(usage: {
    user_id: string;
    date: string;
    embeddings_count?: number;
    clusterings_count?: number;
    searches_count?: number;
    summaries_count?: number;
    total_tokens?: number;
    openai_tokens?: number;
    anthropic_tokens?: number;
    estimated_cost?: string;
  }): Promise<any> {
    const { data, error } = await this.supabase
      .from('ai_usage_daily')
      .upsert({
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
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to upsert daily usage:', error);
      throw new Error(`Failed to upsert daily usage: ${error.message}`);
    }
    
    return data;
  }

  async incrementDailyUsage(
    userId: string,
    date: string,
    operation: 'embedding' | 'clustering' | 'search' | 'summary',
    tokenCount: number,
    provider: 'openai' | 'anthropic',
    cost: number
  ): Promise<any> {
    // First, try to get existing record
    let existing = await this.getDailyUsage(userId, date);
    
    if (!existing) {
      // Create new record with default values
      existing = {
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
        searches_limit: 100
      };
    }
    
    // Increment the appropriate counter
    const updates: any = {
      user_id: userId,
      date,
      total_tokens: (existing.total_tokens || 0) + tokenCount,
      estimated_cost: (parseFloat(existing.estimated_cost || '0') + cost).toFixed(6),
      updated_at: new Date().toISOString()
    };
    
    // Increment operation count
    switch (operation) {
      case 'embedding':
        updates.embeddings_count = (existing.embeddings_count || 0) + 1;
        break;
      case 'clustering':
        updates.clusterings_count = (existing.clusterings_count || 0) + 1;
        break;
      case 'search':
        updates.searches_count = (existing.searches_count || 0) + 1;
        break;
      case 'summary':
        updates.summaries_count = (existing.summaries_count || 0) + 1;
        break;
    }
    
    // Increment provider token count
    if (provider === 'openai') {
      updates.openai_tokens = (existing.openai_tokens || 0) + tokenCount;
    } else {
      updates.anthropic_tokens = (existing.anthropic_tokens || 0) + tokenCount;
    }
    
    const { data, error } = await this.supabase
      .from('ai_usage_daily')
      .upsert(updates, { onConflict: 'user_id,date' })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to increment daily usage:', error);
      throw new Error(`Failed to increment daily usage: ${error.message}`);
    }
    
    return data;
  }

  async getUsageStats(userId: string, days: number = 7): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await this.supabase
      .from('ai_usage_daily')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Failed to get usage stats:', error);
      throw new Error(`Failed to get usage stats: ${error.message}`);
    }
    
    return data || [];
  }

  async addToDeadLetterQueue(item: {
    operation: 'embedding' | 'clustering' | 'search' | 'summary';
    provider: 'openai' | 'anthropic';
    userId?: string;
    payload: unknown;
    errorMessage: string;
    attempts: number;
    lastAttemptAt: Date;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('dead_letter_queue')
      .insert({
        operation: item.operation,
        provider: item.provider,
        user_id: item.userId || null,
        payload: JSON.stringify(item.payload),
        error_message: item.errorMessage,
        attempts: item.attempts,
        last_attempt_at: item.lastAttemptAt.toISOString()
      });
    
    if (error) {
      console.error('Failed to add to dead letter queue:', error);
      throw new Error(`Failed to add to dead letter queue: ${error.message}`);
    }
  }

  async getDeadLetterItems(limit: number = 100): Promise<Array<{
    id: string;
    operation: 'embedding' | 'clustering' | 'search' | 'summary';
    provider: 'openai' | 'anthropic';
    userId?: string;
    payload: unknown;
    errorMessage: string;
    attempts: number;
    createdAt: Date;
    lastAttemptAt: Date;
  }>> {
    const { data, error } = await this.supabase
      .from('dead_letter_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Failed to get dead letter items:', error);
      throw new Error(`Failed to get dead letter items: ${error.message}`);
    }
    
    return (data || []).map((item: any) => ({
      id: item.id,
      operation: item.operation,
      provider: item.provider,
      userId: item.user_id,
      payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload,
      errorMessage: item.error_message,
      attempts: item.attempts,
      createdAt: new Date(item.created_at),
      lastAttemptAt: new Date(item.last_attempt_at)
    }));
  }

  async removeFromDeadLetterQueue(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('dead_letter_queue')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Failed to remove from dead letter queue:', error);
      throw new Error(`Failed to remove from dead letter queue: ${error.message}`);
    }
  }

  // Get article counts per feed for a user
  async getArticleCountsByFeed(userId: string): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    
    // Get user's feeds first
    const userFeeds = await this.getUserFeeds(userId);
    if (userFeeds.length === 0) {
      return result;
    }
    
    const feedIds = userFeeds.map(f => f.id);
    
    // Get article counts for each feed using a single query with grouping
    const { data, error } = await this.supabase
      .from('articles')
      .select('feed_id')
      .in('feed_id', feedIds);
    
    if (error) {
      console.error('Failed to get article counts:', error);
      return result;
    }
    
    // Count articles per feed
    if (data) {
      for (const article of data) {
        const count = result.get(article.feed_id) || 0;
        result.set(article.feed_id, count + 1);
      }
    }
    
    // Ensure all feeds have an entry (even if 0)
    for (const feed of userFeeds) {
      if (!result.has(feed.id)) {
        result.set(feed.id, 0);
      }
    }
    
    return result;
  }
}
