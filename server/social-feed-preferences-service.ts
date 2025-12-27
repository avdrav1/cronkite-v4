import { 
  type UserSettings,
  type InsertUserSettings,
  userSettings
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { getDatabase } from "./production-db";

/**
 * Social feed preference options
 */
export interface SocialFeedPreferences {
  socialFeedEnabled: boolean;
  showFriendActivity: boolean;
  socialFeedPriority: 'social_only' | 'mixed' | 'regular_only';
  shareReadingActivity: boolean;
}

/**
 * Social Feed Preferences Service
 * Implements Requirements: 5.4, 5.5
 * 
 * This service handles:
 * - Toggle for social feed features
 * - Privacy controls for activity sharing
 * - Feed customization options
 */
export class SocialFeedPreferencesService {
  private db = getDatabase();

  /**
   * Get user's social feed preferences
   * Requirements: 5.5 - Allow users to disable social feed features while maintaining friendships
   * 
   * @param userId - User ID
   * @returns Promise<SocialFeedPreferences> - User's social feed preferences
   */
  async getSocialFeedPreferences(userId: string): Promise<SocialFeedPreferences> {
    const [userSettingsRecord] = await this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userId))
      .limit(1);

    if (!userSettingsRecord) {
      // Return default preferences if no settings exist
      return {
        socialFeedEnabled: true,
        showFriendActivity: true,
        socialFeedPriority: 'mixed',
        shareReadingActivity: true
      };
    }

    return {
      socialFeedEnabled: userSettingsRecord.social_feed_enabled,
      showFriendActivity: userSettingsRecord.show_friend_activity,
      socialFeedPriority: userSettingsRecord.social_feed_priority as 'social_only' | 'mixed' | 'regular_only',
      shareReadingActivity: userSettingsRecord.share_reading_activity
    };
  }

  /**
   * Update user's social feed preferences
   * Requirements: 5.4 - Privacy controls for activity sharing
   * Requirements: 5.5 - Feed customization options
   * 
   * @param userId - User ID
   * @param preferences - Updated preferences
   * @returns Promise<SocialFeedPreferences> - Updated preferences
   */
  async updateSocialFeedPreferences(
    userId: string, 
    preferences: Partial<SocialFeedPreferences>
  ): Promise<SocialFeedPreferences> {
    // Validate social feed priority if provided
    if (preferences.socialFeedPriority && 
        !['social_only', 'mixed', 'regular_only'].includes(preferences.socialFeedPriority)) {
      throw new Error('Invalid social feed priority. Must be social_only, mixed, or regular_only');
    }

    // Build update object with snake_case field names
    const updateData: Partial<{
      social_feed_enabled: boolean;
      show_friend_activity: boolean;
      social_feed_priority: string;
      share_reading_activity: boolean;
    }> = {};

    if (preferences.socialFeedEnabled !== undefined) {
      updateData.social_feed_enabled = preferences.socialFeedEnabled;
    }
    if (preferences.showFriendActivity !== undefined) {
      updateData.show_friend_activity = preferences.showFriendActivity;
    }
    if (preferences.socialFeedPriority !== undefined) {
      updateData.social_feed_priority = preferences.socialFeedPriority;
    }
    if (preferences.shareReadingActivity !== undefined) {
      updateData.share_reading_activity = preferences.shareReadingActivity;
    }

    // Check if user settings exist
    const [existingSettings] = await this.db
      .select()
      .from(userSettings)
      .where(eq(userSettings.user_id, userId))
      .limit(1);

    if (!existingSettings) {
      // Create new settings with defaults and provided preferences
      const newSettings: InsertUserSettings = {
        user_id: userId,
        social_feed_enabled: preferences.socialFeedEnabled ?? true,
        show_friend_activity: preferences.showFriendActivity ?? true,
        social_feed_priority: preferences.socialFeedPriority ?? 'mixed',
        share_reading_activity: preferences.shareReadingActivity ?? true
      };

      const [createdSettings] = await this.db
        .insert(userSettings)
        .values(newSettings)
        .returning();

      return {
        socialFeedEnabled: createdSettings.social_feed_enabled,
        showFriendActivity: createdSettings.show_friend_activity,
        socialFeedPriority: createdSettings.social_feed_priority as 'social_only' | 'mixed' | 'regular_only',
        shareReadingActivity: createdSettings.share_reading_activity
      };
    } else {
      // Update existing settings
      const [updatedSettings] = await this.db
        .update(userSettings)
        .set({
          ...updateData,
          updated_at: new Date()
        })
        .where(eq(userSettings.user_id, userId))
        .returning();

      return {
        socialFeedEnabled: updatedSettings.social_feed_enabled,
        showFriendActivity: updatedSettings.show_friend_activity,
        socialFeedPriority: updatedSettings.social_feed_priority as 'social_only' | 'mixed' | 'regular_only',
        shareReadingActivity: updatedSettings.share_reading_activity
      };
    }
  }

  /**
   * Check if user has social feed enabled
   * Requirements: 5.5 - Allow users to disable social feed features
   * 
   * @param userId - User ID
   * @returns Promise<boolean> - Whether social feed is enabled
   */
  async isSocialFeedEnabled(userId: string): Promise<boolean> {
    const preferences = await this.getSocialFeedPreferences(userId);
    return preferences.socialFeedEnabled;
  }

  /**
   * Check if user allows sharing their reading activity
   * Requirements: 5.4 - Privacy controls for activity sharing
   * 
   * @param userId - User ID
   * @returns Promise<boolean> - Whether user allows sharing reading activity
   */
  async canShareReadingActivity(userId: string): Promise<boolean> {
    const preferences = await this.getSocialFeedPreferences(userId);
    return preferences.shareReadingActivity;
  }

  /**
   * Get user's preferred feed display mode
   * Requirements: 5.3 - Filtering options for social vs regular feed
   * 
   * @param userId - User ID
   * @returns Promise<'social_only' | 'mixed' | 'regular_only'> - User's preferred feed mode
   */
  async getFeedDisplayMode(userId: string): Promise<'social_only' | 'mixed' | 'regular_only'> {
    const preferences = await this.getSocialFeedPreferences(userId);
    return preferences.socialFeedPriority;
  }
}

// Export singleton instance
export const socialFeedPreferencesService = new SocialFeedPreferencesService();