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
  };
}

export default useFeedsQuery;
