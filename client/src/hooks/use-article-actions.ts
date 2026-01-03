import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

/**
 * Hook for article actions that automatically invalidates relevant queries
 * This ensures article counts update immediately after actions
 */
export function useArticleActions() {
  const queryClient = useQueryClient();

  const invalidateArticleCounts = () => {
    queryClient.invalidateQueries({ queryKey: ['article-counts'] });
    queryClient.invalidateQueries({ queryKey: ['user-feeds'] });
  };

  const markAsRead = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await apiRequest('POST', `/api/articles/${articleId}/read`);
      return response.json();
    },
    onSuccess: () => {
      invalidateArticleCounts();
    },
  });

  const markAsUnread = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await apiRequest('DELETE', `/api/articles/${articleId}/read`);
      return response.json();
    },
    onSuccess: () => {
      invalidateArticleCounts();
    },
  });

  const toggleStar = useMutation({
    mutationFn: async ({ articleId, starred }: { articleId: string; starred: boolean }) => {
      const method = starred ? 'POST' : 'DELETE';
      const response = await apiRequest(method, `/api/articles/${articleId}/star`);
      return response.json();
    },
    onSuccess: () => {
      invalidateArticleCounts();
    },
  });

  const removeArticle = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await apiRequest('DELETE', `/api/articles/${articleId}`);
      return response.json();
    },
    onSuccess: () => {
      invalidateArticleCounts();
    },
  });

  return {
    markAsRead,
    markAsUnread,
    toggleStar,
    removeArticle,
  };
}
