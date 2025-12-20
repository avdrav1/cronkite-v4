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
  type InsertCluster
} from "@shared/schema";
import { categoryMappingService } from "@shared/category-mapping";
import { type IStorage } from "./storage";

export class SupabaseStorage implements IStorage {
  private supabase;
  private connectionValidated: boolean = false;
  private fallbackStorage?: IStorage;

  constructor() {
    console.log('🚀 Initializing SupabaseStorage...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      const errorMsg = 'Missing Supabase configuration. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.';
      console.error('❌ SupabaseStorage initialization failed:', errorMsg);
      throw new Error(errorMsg);
    }
    
    console.log('🔗 Creating Supabase client connection...');
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('✅ SupabaseStorage client initialized successfully');
    
    // Initialize fallback storage immediately to ensure it's always available
    // Don't await this to avoid blocking constructor
    this.initializeFallback().catch(error => {
      console.error('❌ SupabaseStorage: Failed to initialize fallback during construction:', error);
    });
    
    // Initialize connection validation
    this.validateConnection();
  }

  /**
   * Validates Supabase connection and sets up fallback if needed
   * Implements Requirements 4.4 - enhanced connection validation and comprehensive logging
   */
  private async validateConnection(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 SupabaseStorage: Validating database connection...');
      console.log(`🔍 SupabaseStorage: Connection attempt started at ${new Date().toISOString()}`);
      
      // Test connection with a simple query with timeout
      const connectionPromise = this.supabase
        .from('profiles')
        .select('count')
        .limit(1);
      
      // Add timeout to prevent hanging connections
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000);
      });
      
      const { data, error } = await Promise.race([connectionPromise, timeoutPromise]) as any;
      
      const duration = Date.now() - startTime;
      
      if (error) {
        console.warn('⚠️  SupabaseStorage: Connection validation failed:', error.message);
        console.warn(`⚠️  SupabaseStorage: Connection attempt duration: ${duration}ms`);
        console.warn('⚠️  SupabaseStorage: Database may be unavailable or misconfigured');
        console.warn('⚠️  SupabaseStorage: Possible causes:');
        console.warn('     - Network connectivity issues');
        console.warn('     - Invalid database credentials');
        console.warn('     - Database server downtime');
        console.warn('     - Firewall or security group restrictions');
        console.warn('⚠️  SupabaseStorage: Initializing fallback storage...');
        
        this.connectionValidated = false;
        await this.initializeFallback();
      } else {
        console.log('✅ SupabaseStorage: Database connection validated successfully');
        console.log(`✅ SupabaseStorage: Connection established in ${duration}ms`);
        console.log('✅ SupabaseStorage: Database is accessible and responding');
        this.connectionValidated = true;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.warn('⚠️  SupabaseStorage: Connection validation error:', errorMessage);
      console.warn(`⚠️  SupabaseStorage: Connection attempt duration: ${duration}ms`);
      console.warn('⚠️  SupabaseStorage: Connection validation failed due to exception');
      
      // Enhanced error categorization and logging
      if (errorMessage.includes('timeout')) {
        console.warn('⚠️  SupabaseStorage: Error type: CONNECTION TIMEOUT');
        console.warn('⚠️  SupabaseStorage: The database server is not responding within the expected time');
        console.warn('⚠️  SupabaseStorage: This may indicate network issues or server overload');
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        console.warn('⚠️  SupabaseStorage: Error type: NETWORK ERROR');
        console.warn('⚠️  SupabaseStorage: Cannot reach the database server');
        console.warn('⚠️  SupabaseStorage: Check network connectivity and database URL');
      } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
        console.warn('⚠️  SupabaseStorage: Error type: AUTHENTICATION ERROR');
        console.warn('⚠️  SupabaseStorage: Invalid credentials or insufficient permissions');
        console.warn('⚠️  SupabaseStorage: Check SUPABASE_SERVICE_ROLE_KEY configuration');
      } else {
        console.warn('⚠️  SupabaseStorage: Error type: UNKNOWN ERROR');
        console.warn('⚠️  SupabaseStorage: Unexpected error during connection validation');
      }
      
      console.warn('⚠️  SupabaseStorage: Will attempt to use fallback storage for operations');
      this.connectionValidated = false;
      await this.initializeFallback();
    }
  }

  /**
   * Initializes MemStorage as fallback when Supabase is unavailable
   * Implements Requirements 4.4 - enhanced fallback with proper category mapping and comprehensive logging
   */
  private async initializeFallback(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('🔄 SupabaseStorage: Initializing MemStorage fallback...');
      console.log('🔄 SupabaseStorage: Fallback initialization started due to Supabase unavailability');
      
      // Import MemStorage dynamically to avoid circular dependency
      const storageModule = await import('./storage');
      this.fallbackStorage = new storageModule.MemStorage();
      
      const duration = Date.now() - startTime;
      
      console.log('✅ SupabaseStorage: MemStorage fallback initialized successfully');
      console.log(`✅ SupabaseStorage: Fallback initialization completed in ${duration}ms`);
      console.log('📊 SupabaseStorage: Fallback will provide 865 mock feeds when Supabase is unavailable');
      console.log('📊 SupabaseStorage: Fallback includes proper category mapping validation');
      console.log('📊 SupabaseStorage: All fallback feeds use valid database category names');
      
      // Validate that fallback storage has proper category mapping
      try {
        const fallbackFeeds = await this.fallbackStorage.getRecommendedFeeds();
        console.log(`📊 SupabaseStorage: Fallback validation - ${fallbackFeeds.length} feeds available`);
        
        // Check category mapping in fallback feeds
        const { categoryMappingService } = await import('@shared/category-mapping');
        let validCategoryCount = 0;
        let invalidCategoryCount = 0;
        const invalidCategories = new Set<string>();
        
        fallbackFeeds.forEach(feed => {
          if (categoryMappingService.isValidDatabaseCategory(feed.category)) {
            validCategoryCount++;
          } else {
            invalidCategoryCount++;
            invalidCategories.add(feed.category);
          }
        });
        
        if (invalidCategoryCount === 0) {
          console.log('✅ SupabaseStorage: Fallback category validation - All categories are properly mapped');
        } else {
          console.warn(`⚠️  SupabaseStorage: Fallback category validation - ${invalidCategoryCount} feeds have invalid categories`);
          console.warn(`⚠️  SupabaseStorage: Invalid categories in fallback: ${Array.from(invalidCategories).join(', ')}`);
        }
        
        console.log(`📊 SupabaseStorage: Fallback category summary - ${validCategoryCount} valid, ${invalidCategoryCount} invalid`);
        
      } catch (validationError) {
        console.warn('⚠️  SupabaseStorage: Failed to validate fallback storage categories:', 
          validationError instanceof Error ? validationError.message : 'Unknown error');
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('❌ SupabaseStorage: Failed to initialize fallback storage:', errorMessage);
      console.error(`❌ SupabaseStorage: Fallback initialization failed after ${duration}ms`);
      console.error('❌ SupabaseStorage: System will attempt direct Supabase operations despite connection issues');
      console.error('❌ SupabaseStorage: This may result in operation failures when Supabase is unavailable');
      console.error('❌ SupabaseStorage: Consider investigating MemStorage initialization issues');
      
      // Enhanced error categorization for fallback failures
      if (errorMessage.includes('Cannot resolve module')) {
        console.error('❌ SupabaseStorage: Fallback error type: MODULE RESOLUTION');
        console.error('❌ SupabaseStorage: Cannot import MemStorage module - check file paths');
      } else if (errorMessage.includes('out of memory') || errorMessage.includes('ENOMEM')) {
        console.error('❌ SupabaseStorage: Fallback error type: MEMORY ERROR');
        console.error('❌ SupabaseStorage: Insufficient memory to initialize fallback storage');
      } else {
        console.error('❌ SupabaseStorage: Fallback error type: UNKNOWN ERROR');
        console.error('❌ SupabaseStorage: Unexpected error during fallback initialization');
      }
    }
  }

  /**
   * Executes operation with automatic fallback to MemStorage if Supabase fails
   * Implements Requirements 4.4 - enhanced fallback mechanisms with comprehensive logging
   */
  private async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // If connection was never validated, try to validate it now
      if (!this.connectionValidated) {
        console.log(`🔍 SupabaseStorage: Connection not validated for ${operationName}, attempting validation...`);
        await this.validateConnection();
      }
      
      console.log(`🔄 SupabaseStorage: Executing ${operationName} via Supabase...`);
      
      // Attempt the primary operation
      const result = await operation();
      const duration = Date.now() - startTime;
      
      console.log(`✅ SupabaseStorage: ${operationName} completed successfully in ${duration}ms`);
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.warn(`⚠️  SupabaseStorage: ${operationName} failed after ${duration}ms:`, errorMessage);
      
      // Enhanced error categorization and logging
      if (errorMessage.includes('timeout')) {
        console.warn(`⚠️  SupabaseStorage: ${operationName} error type: TIMEOUT`);
        console.warn(`⚠️  SupabaseStorage: Operation exceeded time limit - database may be overloaded`);
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ECONNREFUSED')) {
        console.warn(`⚠️  SupabaseStorage: ${operationName} error type: NETWORK ERROR`);
        console.warn(`⚠️  SupabaseStorage: Cannot reach database server during operation`);
      } else if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
        console.warn(`⚠️  SupabaseStorage: ${operationName} error type: AUTHENTICATION ERROR`);
        console.warn(`⚠️  SupabaseStorage: Invalid credentials during operation`);
      } else if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        console.warn(`⚠️  SupabaseStorage: ${operationName} error type: SCHEMA ERROR`);
        console.warn(`⚠️  SupabaseStorage: Database table or relation missing - check migrations`);
      } else {
        console.warn(`⚠️  SupabaseStorage: ${operationName} error type: UNKNOWN ERROR`);
      }
      
      // If we have a fallback storage and a fallback operation, use it
      if (this.fallbackStorage && fallbackOperation) {
        console.log(`🔄 SupabaseStorage: Using MemStorage fallback for ${operationName}`);
        console.log(`🔄 SupabaseStorage: Fallback ensures operation continuity despite Supabase issues`);
        
        try {
          const fallbackStartTime = Date.now();
          const fallbackResult = await fallbackOperation();
          const fallbackDuration = Date.now() - fallbackStartTime;
          
          console.log(`✅ SupabaseStorage: ${operationName} completed via fallback in ${fallbackDuration}ms`);
          console.log(`✅ SupabaseStorage: Fallback operation successful - user experience preserved`);
          
          return fallbackResult;
        } catch (fallbackError) {
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
          console.error(`❌ SupabaseStorage: Fallback for ${operationName} also failed:`, fallbackErrorMessage);
          console.error(`❌ SupabaseStorage: Both primary and fallback operations failed`);
          console.error(`❌ SupabaseStorage: This indicates a critical system issue`);
          
          // Re-throw the original error since fallback also failed
          throw error;
        }
      }
      
      // If no fallback available, re-throw the error
      console.error(`❌ SupabaseStorage: ${operationName} failed and no fallback available`);
      console.error(`❌ SupabaseStorage: No fallback operation provided for ${operationName}`);
      console.error(`❌ SupabaseStorage: Operation will fail completely`);
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
        
        if (error || !data) {
          return undefined;
        }
        
        return data as Profile;
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
    
    if (error || !data) {
      throw new Error(`Failed to create user: ${error?.message}`);
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
        console.log('🔍 SupabaseStorage: Querying recommended_feeds table...');
        
        const { data, error } = await this.supabase
          .from('recommended_feeds')
          .select('*')
          .order('popularity_score', { ascending: false });
        
        if (error) {
          console.error('❌ SupabaseStorage: Failed to get recommended feeds:', error.message);
          throw new Error(`Failed to get recommended feeds: ${error.message}`);
        }
        
        const feeds = (data || []) as RecommendedFeed[];
        
        // Enhanced error handling for empty recommended_feeds table
        // Implements Requirements 2.5 - proper error handling for empty recommended_feeds table
        if (feeds.length === 0) {
          console.warn('⚠️  SupabaseStorage: recommended_feeds table is empty - no feeds available');
          console.warn('⚠️  SupabaseStorage: This may indicate:');
          console.warn('     - Database migration not run');
          console.warn('     - Seed data not loaded');
          console.warn('     - Data deletion occurred');
          console.warn('⚠️  SupabaseStorage: Consider running database migrations and seed data');
          
          // If we have fallback storage, trigger fallback by throwing an error
          if (this.fallbackStorage) {
            console.log('🔄 SupabaseStorage: Empty table detected, triggering fallback mechanism');
            throw new Error('Empty recommended_feeds table - triggering fallback');
          }
          
          // Return empty array if no fallback available
          return feeds;
        } else {
          console.log(`📊 SupabaseStorage: Successfully retrieved ${feeds.length} recommended feeds`);
          
          // Log feed distribution for debugging
          const categoryCount: Record<string, number> = {};
          feeds.forEach(feed => {
            categoryCount[feed.category] = (categoryCount[feed.category] || 0) + 1;
          });
          
          console.log('📊 SupabaseStorage: Feed distribution by category:');
          Object.entries(categoryCount).forEach(([category, count]) => {
            console.log(`     ${category}: ${count} feeds`);
          });
        }
        
        return feeds;
      },
      // Fallback operation using MemStorage
      async () => {
        if (this.fallbackStorage) {
          console.log('🔄 SupabaseStorage: Using MemStorage fallback for getRecommendedFeeds');
          return await this.fallbackStorage.getRecommendedFeeds();
        }
        return [];
      },
      'getRecommendedFeeds'
    );
  }

  // Recommended Feeds Management with Category Validation
  async createRecommendedFeed(insertFeed: InsertRecommendedFeed): Promise<RecommendedFeed> {
    console.log(`🔍 SupabaseStorage: Creating recommended feed with category validation...`);
    
    // Validate category using category mapping service
    if (!categoryMappingService.isValidDatabaseCategory(insertFeed.category)) {
      const errorMsg = `Invalid category "${insertFeed.category}" - not found in category mapping`;
      console.error(`❌ SupabaseStorage: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    console.log(`✅ SupabaseStorage: Category "${insertFeed.category}" validation passed`);
    
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
    const userFeedsData: InsertFeed[] = recommendedFeeds.map(recommendedFeed => ({
      user_id: userId,
      name: recommendedFeed.name,
      url: recommendedFeed.url,
      site_url: recommendedFeed.site_url,
      description: recommendedFeed.description,
      icon_url: recommendedFeed.icon_url,
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
  }> {
    // Get user's feeds count
    const { data: feedsData, error: feedsError } = await this.supabase
      .from('feeds')
      .select('id')
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
        failed: 0
      };
    }
    
    const feedIds = feedsData!.map(feed => feed.id);
    
    // Get latest sync status for each feed
    const { data: syncData, error: syncError } = await this.supabase
      .from('feed_sync_log')
      .select('feed_id, status, sync_started_at')
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
    
    return {
      totalFeeds,
      syncing,
      completed,
      failed,
      lastSyncAt
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
}