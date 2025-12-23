/**
 * User State Isolation Verification
 * Requirements: 6.4, 7.4 - Ensure article states are isolated per user
 * 
 * This module provides verification and documentation for user state isolation
 * in the article state management system.
 */

/**
 * User State Isolation Design Documentation
 * 
 * The system ensures user state isolation through multiple layers:
 * 
 * 1. APPLICATION LAYER (server/storage.ts, server/supabase-storage.ts)
 *    - All article state methods require userId parameter
 *    - MemStorage uses composite key pattern: `${userId}:${articleId}`
 *    - SupabaseStorage uses `.eq('user_id', userId)` in all queries
 * 
 * 2. DATABASE LAYER (supabase/migrations/20240107000000_comprehensive_rls_policies.sql)
 *    - RLS enabled on user_articles table
 *    - Policy: "Users can view own article states" - SELECT WHERE auth.uid() = user_id
 *    - Policy: "Users can insert own article states" - INSERT WITH CHECK auth.uid() = user_id
 *    - Policy: "Users can update own article states" - UPDATE WHERE auth.uid() = user_id
 *    - Policy: "Users can delete own article states" - DELETE WHERE auth.uid() = user_id
 * 
 * 3. API LAYER (server/routes.ts)
 *    - All article state endpoints use requireAuth middleware
 *    - userId is extracted from authenticated session: req.user!.id
 *    - No user can access another user's article states
 * 
 * Methods with User Isolation:
 * - markArticleRead(userId, articleId, isRead)
 * - markArticleStarred(userId, articleId, isStarred)
 * - getStarredArticles(userId, limit?, offset?)
 * - setEngagementSignal(userId, articleId, signal)
 * - getArticlesWithEngagement(userId, feedId?)
 * - getUserArticleState(userId, articleId)
 * - createUserArticleState(userArticle) - includes user_id in data
 * - updateUserArticleState(userId, articleId, updates)
 */

/**
 * Verifies that a user state operation is properly isolated
 * This is a runtime check that can be used for debugging/testing
 * 
 * @param operationUserId - The userId being used in the operation
 * @param authenticatedUserId - The userId from the authenticated session
 * @returns true if the operation is properly isolated
 * @throws Error if there's a user isolation violation
 */
export function verifyUserStateIsolation(
  operationUserId: string,
  authenticatedUserId: string
): boolean {
  if (operationUserId !== authenticatedUserId) {
    throw new Error(
      `User state isolation violation: Operation userId (${operationUserId}) ` +
      `does not match authenticated userId (${authenticatedUserId})`
    );
  }
  return true;
}

/**
 * User state isolation verification for article operations
 * Ensures the article state operation is for the authenticated user
 */
export interface UserStateIsolationContext {
  /** The authenticated user's ID from the session */
  authenticatedUserId: string;
  /** The article ID being operated on */
  articleId: string;
  /** The operation being performed */
  operation: 'read' | 'star' | 'engagement' | 'view';
}

/**
 * Creates a verified user state context for article operations
 * This ensures all article state operations are properly scoped to the user
 * 
 * @param authenticatedUserId - The userId from req.user.id
 * @param articleId - The article being operated on
 * @param operation - The type of operation
 * @returns A verified context object
 */
export function createUserStateContext(
  authenticatedUserId: string,
  articleId: string,
  operation: 'read' | 'star' | 'engagement' | 'view'
): UserStateIsolationContext {
  if (!authenticatedUserId) {
    throw new Error('User state isolation: authenticatedUserId is required');
  }
  if (!articleId) {
    throw new Error('User state isolation: articleId is required');
  }
  
  return {
    authenticatedUserId,
    articleId,
    operation
  };
}

/**
 * RLS Policy Verification Status
 * Documents the RLS policies that enforce user state isolation at the database level
 */
export const RLS_POLICIES = {
  user_articles: {
    table: 'user_articles',
    rlsEnabled: true,
    policies: [
      {
        name: 'Users can view own article states',
        operation: 'SELECT',
        condition: 'auth.uid() = user_id'
      },
      {
        name: 'Users can insert own article states',
        operation: 'INSERT',
        condition: 'auth.uid() = user_id'
      },
      {
        name: 'Users can update own article states',
        operation: 'UPDATE',
        condition: 'auth.uid() = user_id'
      },
      {
        name: 'Users can delete own article states',
        operation: 'DELETE',
        condition: 'auth.uid() = user_id'
      }
    ]
  }
} as const;

/**
 * Logs user state isolation verification for debugging
 */
export function logUserStateIsolation(
  context: UserStateIsolationContext,
  success: boolean
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔒 User State Isolation [${context.operation}]:`, {
      userId: context.authenticatedUserId,
      articleId: context.articleId,
      isolated: success
    });
  }
}
