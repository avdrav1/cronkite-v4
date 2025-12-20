import { createClient } from '@supabase/supabase-js';
import { 
  type Profile, 
  type InsertProfile, 
  type UserSettings, 
  type InsertUserSettings,
  type UserInterests,
  type InsertUserInterests,
  type RecommendedFeed,
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
import { type IStorage } from "./storage";

export class SupabaseStorage implements IStorage {
  private supabase;

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
  }

  // User Management
  async getUser(id: string): Promise<Profile | undefined> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
    return data as Profile;
  }

  async getUserByEmail(email: string): Promise<Profile | undefined> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) {
      return undefined;
    }
    
    return data as Profile;
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
    
    // Create profile with the auth user ID
    const profileData: InsertProfile = {
      ...user,
      id: authData.user.id
    };
    
    const profile = await this.createUser(profileData);
    
    // Create default user settings
    await this.createUserSettings(profile.id);
    
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
    const { data, error } = await this.supabase
      .from('recommended_feeds')
      .select('*')
      .order('popularity_score', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get recommended feeds: ${error.message}`);
    }
    
    return (data || []) as RecommendedFeed[];
  }

  // User Feed Subscription Management
  async getUserFeeds(userId: string): Promise<Feed[]> {
    const { data, error } = await this.supabase
      .from('feeds')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to get user feeds: ${error.message}`);
    }
    
    return (data || []) as Feed[];
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