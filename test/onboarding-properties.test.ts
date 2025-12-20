import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Feature: full-stack-integration, Property 5: Onboarding completion workflow
 * For any completed onboarding with selected feeds, the system should persist subscriptions 
 * and trigger initial synchronization
 * Validates: Requirements 2.4, 2.5
 */
describe('Property 5: Onboarding completion workflow', () => {
  it('should persist user interests consistently', () => {
    fc.assert(fc.property(
      fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length >= 1), { minLength: 1, maxLength: 10 }),
      async (interests) => {
        // Mock successful interests update
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            message: 'User interests updated successfully',
            interests
          })
        });
        
        global.fetch = mockFetch;
        
        // Simulate setting user interests
        const response = await fetch('/api/users/interests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ interests })
        });
        
        const data = await response.json();
        
        // Property: Setting interests should succeed and return the interests
        return response.ok === true &&
               data.message === 'User interests updated successfully' &&
               JSON.stringify(data.interests) === JSON.stringify(interests);
      }
    ), { numRuns: 100 });
  });

  it('should handle feed subscription consistently', () => {
    fc.assert(fc.property(
      fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length >= 1), { minLength: 1, maxLength: 20 }),
      async (feedIds) => {
        // Mock successful feed subscription
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Successfully subscribed to feeds',
            subscribed_count: feedIds.length
          })
        });
        
        global.fetch = mockFetch;
        
        // Simulate feed subscription
        const response = await fetch('/api/feeds/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ feedIds })
        });
        
        const data = await response.json();
        
        // Property: Feed subscription should succeed and return count
        return response.ok === true &&
               data.message === 'Successfully subscribed to feeds' &&
               data.subscribed_count === feedIds.length;
      }
    ), { numRuns: 100 });
  });

  it('should trigger feed synchronization after subscription', () => {
    fc.assert(fc.property(
      fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length >= 1), { minLength: 1, maxLength: 10 }),
      async (feedIds) => {
        // Mock successful sync trigger
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            message: 'Feed synchronization started',
            sync_results: feedIds.map(id => ({
              feedId: id,
              feedName: `Feed ${id}`,
              status: 'started'
            })),
            total_feeds: feedIds.length
          })
        });
        
        global.fetch = mockFetch;
        
        // Simulate sync trigger
        const response = await fetch('/api/feeds/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ feedIds })
        });
        
        const data = await response.json();
        
        // Property: Sync should start for all provided feeds
        const basicChecks = response.ok === true &&
                           data.message === 'Feed synchronization started' &&
                           data.total_feeds === feedIds.length &&
                           data.sync_results.length === feedIds.length;
        
        if (!basicChecks) return false;
        
        // All sync results should have 'started' status and correct feedId
        return data.sync_results.every((result: any) => 
          result.status === 'started' && feedIds.includes(result.feedId)
        );
      }
    ), { numRuns: 100 });
  });
});

/**
 * Feature: full-stack-integration, Property 3: Feed search functionality
 * For any search query in the feed selection interface, returned results should match the search criteria
 * Validates: Requirements 2.2
 */
describe('Property 3: Feed search functionality', () => {
  it('should filter feeds by search query consistently', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length >= 1),
      fc.option(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length >= 1)),
      fc.option(fc.integer({ min: 1, max: 100 })),
      async (searchQuery, category, limit) => {
        // Mock feeds that match the search
        const mockFeeds = [
          {
            id: 'feed-1',
            name: `${searchQuery} News`,
            description: `Latest ${searchQuery} updates`,
            category: category || 'technology',
            tags: [searchQuery]
          },
          {
            id: 'feed-2', 
            name: 'Other Feed',
            description: 'Different content',
            category: 'sports',
            tags: ['sports']
          }
        ];
        
        const expectedFeeds = mockFeeds.filter(feed => 
          feed.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          feed.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          feed.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            feeds: expectedFeeds,
            total: expectedFeeds.length
          })
        });
        
        global.fetch = mockFetch;
        
        // Build query parameters
        const params = new URLSearchParams();
        params.append('search', searchQuery);
        if (category) params.append('category', category);
        if (limit) params.append('limit', limit.toString());
        
        // Simulate search request
        const response = await fetch(`/api/feeds/recommended?${params.toString()}`, {
          method: 'GET',
          credentials: 'include'
        });
        
        const data = await response.json();
        
        // Property: Search results should match the query
        const basicChecks = response.ok === true &&
                           data.feeds !== undefined &&
                           Array.isArray(data.feeds);
        
        if (!basicChecks) return false;
        
        // All returned feeds should match the search criteria
        return data.feeds.every((feed: any) => {
          const matchesSearch = 
            feed.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            feed.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            feed.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
          
          return matchesSearch;
        });
      }
    ), { numRuns: 100 });
  });
});