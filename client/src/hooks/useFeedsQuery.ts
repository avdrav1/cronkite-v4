import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { Feed } from '@shared/schema';

/**
 * Response type from /api/feeds/user endpoint
 */
export interface UserFeedsResponse {
  feeds: Feed[];
  total: number;
}

/**
 * Response type from /api/feeds/count endpoint
 */
export interface FeedCountResponse {
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  isNearLimit: boolean;
}

/**
 * Hook for fetching user's subscribed feeds
 * Uses TanStack Query with 5-minute stale time for caching
 * 
 * @returns Query result with user's feeds
 * 
 * Requirements: 3.1, 5.3
 */
export function useFeedsQuery() {
  return useQuery<UserFeedsResponse>({
    queryKey: ['user-feeds'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/feeds/user');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to invalidate the user feeds query
 * Useful for triggering refetch after subscribe/unsubscribe
 * 
 * Requirements: 5.1, 5.2
 */
export function useInvalidateFeedsQuery() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['user-feeds'] });
    queryClient.invalidateQueries({ queryKey: ['feed-count'] });
  };
}

/**
 * Hook for fetching user's feed count and capacity
 * Uses TanStack Query with 1-minute stale time for more frequent updates
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export function useFeedCountQuery() {
  return useQuery<FeedCountResponse>({
    queryKey: ['feed-count'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/feeds/count');
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export default useFeedsQuery;
