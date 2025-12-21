import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemStorage } from '../server/storage';

describe('Enhanced Database Connectivity Fallback', () => {
  let memStorage: MemStorage;

  beforeEach(() => {
    // Clear console to avoid noise in tests
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
  });

  afterEach(() => {
    // Restore console
    console.log = console.log;
    console.warn = console.warn;
    console.error = console.error;
  });

  describe('MemStorage Enhanced Initialization', () => {
    it('should initialize MemStorage with proper category mapping validation', async () => {
      memStorage = new MemStorage();
      
      // Should have real feeds (no longer generating fake feeds)
      const feeds = await memStorage.getRecommendedFeeds();
      expect(feeds.length).toBeGreaterThan(0);
      
      // All feeds should have valid categories
      const { categoryMappingService } = await import('../shared/category-mapping');
      
      let validCategoryCount = 0;
      let invalidCategoryCount = 0;
      
      feeds.forEach(feed => {
        if (categoryMappingService.isValidDatabaseCategory(feed.category)) {
          validCategoryCount++;
        } else {
          invalidCategoryCount++;
        }
      });
      
      // All categories should be valid (requirement 4.4 - proper category mapping)
      expect(invalidCategoryCount).toBe(0);
      expect(validCategoryCount).toBe(feeds.length);
    });

    it('should validate feed data structure consistency', async () => {
      memStorage = new MemStorage();
      const feeds = await memStorage.getRecommendedFeeds();
      
      // Check required fields are present
      feeds.forEach((feed, index) => {
        expect(feed.id, `Feed ${index} should have id`).toBeDefined();
        expect(feed.name, `Feed ${index} should have name`).toBeDefined();
        expect(feed.url, `Feed ${index} should have url`).toBeDefined();
        expect(feed.category, `Feed ${index} should have category`).toBeDefined();
        expect(feed.country, `Feed ${index} should have country`).toBeDefined();
        expect(feed.language, `Feed ${index} should have language`).toBeDefined();
        expect(typeof feed.popularity_score, `Feed ${index} should have numeric popularity_score`).toBe('number');
        expect(typeof feed.is_featured, `Feed ${index} should have boolean is_featured`).toBe('boolean');
      });
      
      // Check for unique IDs
      const ids = feeds.map(feed => feed.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      
      // Check for unique URLs
      const urls = feeds.map(feed => feed.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(urls.length);
    });

    it('should create feeds with valid database category names', async () => {
      memStorage = new MemStorage();
      
      const testFeed = {
        name: 'Test Tech Feed',
        url: 'https://example.com/tech-feed.xml',
        site_url: 'https://example.com',
        description: 'A test technology feed',
        category: 'Technology', // Valid database category name
        country: 'US',
        language: 'en',
        tags: ['technology', 'test'],
        popularity_score: 85,
        is_featured: false
      };
      
      // Should succeed with valid category
      const createdFeed = await memStorage.createRecommendedFeed(testFeed);
      expect(createdFeed.category).toBe('Technology');
      expect(createdFeed.name).toBe('Test Tech Feed');
    });

    it('should reject feeds with invalid category names', async () => {
      memStorage = new MemStorage();
      
      const testFeed = {
        name: 'Test Invalid Feed',
        url: 'https://example.com/invalid-feed.xml',
        site_url: 'https://example.com',
        description: 'A test feed with invalid category',
        category: 'InvalidCategory', // Invalid database category name
        country: 'US',
        language: 'en',
        tags: ['test'],
        popularity_score: 85,
        is_featured: false
      };
      
      // Should fail with invalid category
      await expect(memStorage.createRecommendedFeed(testFeed))
        .rejects
        .toThrow('Invalid category "InvalidCategory" - not found in category mapping');
    });
  });

  describe('Category Mapping Integration', () => {
    it('should validate all mock feeds have proper category mappings', async () => {
      memStorage = new MemStorage();
      const feeds = await memStorage.getRecommendedFeeds();
      
      const { categoryMappingService } = await import('../shared/category-mapping');
      
      // Group feeds by category
      const categoryCount: Record<string, number> = {};
      feeds.forEach(feed => {
        categoryCount[feed.category] = (categoryCount[feed.category] || 0) + 1;
      });
      
      // Verify all categories are valid
      Object.keys(categoryCount).forEach(category => {
        expect(categoryMappingService.isValidDatabaseCategory(category), 
          `Category "${category}" should be valid in category mapping`).toBe(true);
      });
      
      // Should have feeds across multiple categories
      expect(Object.keys(categoryCount).length).toBeGreaterThan(5);
    });

    it('should support bidirectional category mapping', async () => {
      const { categoryMappingService } = await import('../shared/category-mapping');
      
      // Test frontend to database mapping
      expect(categoryMappingService.frontendToDatabase('tech')).toBe('Technology');
      expect(categoryMappingService.frontendToDatabase('business')).toBe('Business');
      expect(categoryMappingService.frontendToDatabase('gaming')).toBe('Gaming');
      
      // Test database to frontend mapping
      expect(categoryMappingService.databaseToFrontend('Technology')).toBe('tech');
      expect(categoryMappingService.databaseToFrontend('Business')).toBe('business');
      expect(categoryMappingService.databaseToFrontend('Gaming')).toBe('gaming');
      
      // Test validation methods
      expect(categoryMappingService.isValidFrontendCategory('tech')).toBe(true);
      expect(categoryMappingService.isValidDatabaseCategory('Technology')).toBe(true);
      expect(categoryMappingService.isValidFrontendCategory('invalid')).toBe(false);
      expect(categoryMappingService.isValidDatabaseCategory('Invalid')).toBe(false);
    });
  });

  describe('Enhanced Error Handling', () => {
    it('should provide comprehensive logging during initialization', () => {
      // This test verifies that the enhanced logging is in place
      // The actual logging is tested through console output in the implementation
      
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      memStorage = new MemStorage();
      
      // Should have logged initialization messages
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('MemStorage: Starting in-memory storage initialization')
      );
      
      logSpy.mockRestore();
    });
  });
});