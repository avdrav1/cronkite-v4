import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the Supabase client before importing SupabaseStorage
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        }))
      })),
      order: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      })),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: null, error: null })
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null })
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  })),
  auth: {
    signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
    admin: {
      createUser: vi.fn().mockResolvedValue({ data: null, error: null }),
      updateUserById: vi.fn().mockResolvedValue({ error: null })
    }
  }
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

// Mock MemStorage
const mockMemStorage = {
  getRecommendedFeeds: vi.fn().mockResolvedValue([
    {
      id: 'test-feed-1',
      name: 'Test Feed',
      url: 'https://example.com/feed.xml',
      category: 'Technology',
      country: 'US',
      language: 'en'
    }
  ]),
  getUser: vi.fn().mockResolvedValue(undefined),
  getUserByEmail: vi.fn().mockResolvedValue(undefined),
  getUserFeeds: vi.fn().mockResolvedValue([])
};

vi.mock('./storage', () => ({
  MemStorage: vi.fn(() => mockMemStorage)
}));

// Now import SupabaseStorage after mocks are set up
import { SupabaseStorage } from './supabase-storage';

describe('SupabaseStorage Fallback Mechanisms', () => {
  let storage: SupabaseStorage;

  beforeEach(() => {
    // Reset environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-key-that-is-long-enough-to-pass-validation-checks-and-looks-like-a-real-jwt-token';
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty Database Responses', () => {
    it('should handle empty recommended_feeds table gracefully', async () => {
      // Mock empty response from Supabase
      mockSupabaseClient.from().select().order.mockResolvedValue({
        data: [],
        error: null
      });

      storage = new SupabaseStorage();
      
      // Wait for connection validation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const feeds = await storage.getRecommendedFeeds();
      
      // Should return empty array when Supabase returns empty
      expect(feeds).toEqual([]);
    });

    it('should use fallback when Supabase returns empty feeds and fallback is available', async () => {
      // Mock connection validation to fail first, then succeed for the actual operation
      let callCount = 0;
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call (connection validation) fails
          return Promise.resolve({
            data: null,
            error: { message: 'Connection failed' }
          });
        }
        // Subsequent calls succeed
        return Promise.resolve({
          data: [],
          error: null
        });
      });

      // Mock empty response from Supabase for getRecommendedFeeds
      mockSupabaseClient.from().select().order.mockResolvedValue({
        data: [],
        error: null
      });

      storage = new SupabaseStorage();
      
      // Wait for connection validation and fallback initialization
      await new Promise(resolve => setTimeout(resolve, 200));

      const feeds = await storage.getRecommendedFeeds();
      
      // Should return feeds from fallback MemStorage
      expect(feeds).toHaveLength(1);
      expect(feeds[0].name).toBe('Test Feed');
    });
  });

  describe('Connection Failures', () => {
    it('should handle Supabase connection failures and use fallback', async () => {
      // Mock connection validation to fail first
      let callCount = 0;
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'Connection timeout' }
          });
        }
        return Promise.resolve({
          data: [],
          error: null
        });
      });

      // Mock getRecommendedFeeds failure
      mockSupabaseClient.from().select().order.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      storage = new SupabaseStorage();
      
      // Wait for connection validation and fallback initialization
      await new Promise(resolve => setTimeout(resolve, 200));

      const feeds = await storage.getRecommendedFeeds();
      
      // Should use fallback and return mock feeds
      expect(feeds).toHaveLength(1);
      expect(feeds[0].name).toBe('Test Feed');
    });

    it('should handle network errors during database operations', async () => {
      // Mock connection validation to fail first
      let callCount = 0;
      mockSupabaseClient.from().select().limit.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'Network error' }
          });
        }
        return Promise.resolve({
          data: [],
          error: null
        });
      });

      // Mock network error for getRecommendedFeeds
      mockSupabaseClient.from().select().order.mockRejectedValue(
        new Error('Network error: Connection refused')
      );

      storage = new SupabaseStorage();
      
      // Wait for connection validation and fallback initialization
      await new Promise(resolve => setTimeout(resolve, 200));

      const feeds = await storage.getRecommendedFeeds();
      
      // Should use fallback
      expect(feeds).toHaveLength(1);
      expect(feeds[0].name).toBe('Test Feed');
    });
  });

  describe('Invalid Configuration Handling', () => {
    it('should throw error when SUPABASE_URL is missing', () => {
      delete process.env.SUPABASE_URL;
      
      expect(() => new SupabaseStorage()).toThrow('Missing Supabase configuration');
    });

    it('should throw error when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      expect(() => new SupabaseStorage()).toThrow('Missing Supabase configuration');
    });

    it('should handle invalid service key format', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'invalid-key';
      
      // Should still create instance but connection validation will fail
      expect(() => new SupabaseStorage()).not.toThrow();
    });
  });

  describe('Fallback Behavior for User Operations', () => {
    beforeEach(async () => {
      // Mock connection validation to fail so fallback is initialized
      mockSupabaseClient.from().select().limit.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      });

      storage = new SupabaseStorage();
      
      // Wait for connection validation and fallback initialization
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should use fallback for getUser when Supabase fails', async () => {
      // Mock Supabase failure
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const user = await storage.getUser('test-user-id');
      
      // Should use fallback (which returns undefined for non-existent users)
      expect(user).toBeUndefined();
    });

    it('should use fallback for getUserByEmail when Supabase fails', async () => {
      // Mock Supabase failure
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const user = await storage.getUserByEmail('test@example.com');
      
      // Should use fallback
      expect(user).toBeUndefined();
    });

    it('should use fallback for getUserFeeds when Supabase fails', async () => {
      // Mock Supabase failure
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const feeds = await storage.getUserFeeds('test-user-id');
      
      // Should use fallback (which returns empty array)
      expect(feeds).toEqual([]);
    });
  });

  describe('Error Logging and Warning Messages', () => {
    it('should log appropriate warnings when recommended_feeds table is empty', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock empty response
      mockSupabaseClient.from().select().order.mockReturnValue({
        data: [],
        error: null
      });

      storage = new SupabaseStorage();
      
      // Wait for connection validation
      await new Promise(resolve => setTimeout(resolve, 100));

      await storage.getRecommendedFeeds();
      
      // Should log warning about empty table
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('recommended_feeds table is empty')
      );
      
      consoleSpy.mockRestore();
    });

    it('should log connection validation failures', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock connection validation failure
      mockSupabaseClient.from().select().limit.mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout' }
      });

      storage = new SupabaseStorage();
      
      // Wait for connection validation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should log connection validation failure
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Connection validation failed')
      );
      
      consoleSpy.mockRestore();
    });
  });
});