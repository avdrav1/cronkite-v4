/**
 * Production Feed Management Tests
 * 
 * Tests the production feed configuration and validation services
 * to ensure they work correctly in production environments.
 */

import { describe, it, expect } from 'vitest';
import { 
  PRODUCTION_FEEDS, 
  validateAllFeeds,
  getFeedsByPriority,
  getFeedsBySyncInterval,
  getEnabledFeeds,
  convertToRecommendedFeed,
  validateFeedConfig
} from '../server/production-feeds';

describe('Production Feed Management', () => {
  
  describe('1. Production Feed Configuration', () => {
    it('should have valid production feed configuration', () => {
      console.log('🧪 Testing production feed configuration...');
      
      // Test that we have feeds configured
      expect(PRODUCTION_FEEDS.length).toBeGreaterThan(0);
      console.log(`✅ Found ${PRODUCTION_FEEDS.length} production feeds`);
      
      // Test that all feeds have required fields
      PRODUCTION_FEEDS.forEach(feed => {
        expect(feed.id).toBeTruthy();
        expect(feed.name).toBeTruthy();
        expect(feed.url).toBeTruthy();
        expect(feed.category).toBeTruthy();
        expect(feed.priority).toMatch(/^(high|medium|low)$/);
        expect(feed.syncInterval).toMatch(/^(hourly|daily|weekly)$/);
        expect(typeof feed.enabled).toBe('boolean');
      });
      
      console.log('✅ All feeds have required fields');
    });
    
    it('should validate all production feeds', () => {
      console.log('🧪 Testing feed validation...');
      
      const validation = validateAllFeeds();
      
      expect(validation.summary.total).toBe(PRODUCTION_FEEDS.length);
      expect(validation.summary.valid).toBeGreaterThan(0);
      
      // Log validation results
      console.log(`📊 Validation summary:`);
      console.log(`   Total feeds: ${validation.summary.total}`);
      console.log(`   Valid feeds: ${validation.summary.valid}`);
      console.log(`   Invalid feeds: ${validation.summary.invalid}`);
      console.log(`   Warnings: ${validation.summary.warnings}`);
      
      // All feeds should be valid
      expect(validation.summary.invalid).toBe(0);
      
      console.log('✅ All production feeds are valid');
    });
    
    it('should filter feeds by priority correctly', () => {
      console.log('🧪 Testing feed filtering by priority...');
      
      const highPriorityFeeds = getFeedsByPriority('high');
      const mediumPriorityFeeds = getFeedsByPriority('medium');
      const lowPriorityFeeds = getFeedsByPriority('low');
      
      expect(highPriorityFeeds.length).toBeGreaterThan(0);
      expect(mediumPriorityFeeds.length).toBeGreaterThan(0);
      expect(lowPriorityFeeds.length).toBeGreaterThan(0);
      
      // Verify all high priority feeds are actually high priority
      highPriorityFeeds.forEach(feed => {
        expect(feed.priority).toBe('high');
        expect(feed.enabled).toBe(true);
      });
      
      console.log(`✅ Priority filtering works: ${highPriorityFeeds.length} high, ${mediumPriorityFeeds.length} medium, ${lowPriorityFeeds.length} low`);
    });
    
    it('should filter feeds by sync interval correctly', () => {
      console.log('🧪 Testing feed filtering by sync interval...');
      
      const hourlyFeeds = getFeedsBySyncInterval('hourly');
      const dailyFeeds = getFeedsBySyncInterval('daily');
      const weeklyFeeds = getFeedsBySyncInterval('weekly');
      
      expect(hourlyFeeds.length).toBeGreaterThan(0);
      expect(dailyFeeds.length).toBeGreaterThan(0);
      
      // Verify sync intervals are correct
      hourlyFeeds.forEach(feed => {
        expect(feed.syncInterval).toBe('hourly');
        expect(feed.enabled).toBe(true);
      });
      
      console.log(`✅ Sync interval filtering works: ${hourlyFeeds.length} hourly, ${dailyFeeds.length} daily, ${weeklyFeeds.length} weekly`);
    });
    
    it('should convert to recommended feed format correctly', () => {
      console.log('🧪 Testing conversion to recommended feed format...');
      
      const productionFeed = PRODUCTION_FEEDS[0];
      const recommendedFeed = convertToRecommendedFeed(productionFeed);
      
      expect(recommendedFeed.id).toBe(productionFeed.id);
      expect(recommendedFeed.name).toBe(productionFeed.name);
      expect(recommendedFeed.url).toBe(productionFeed.url);
      expect(recommendedFeed.category).toBe(productionFeed.category);
      expect(recommendedFeed.popularity_score).toBe(productionFeed.popularity_score);
      expect(recommendedFeed.is_featured).toBe(productionFeed.is_featured);
      
      console.log('✅ Feed conversion works correctly');
    });
  });
  
  describe('2. Feed Validation Service', () => {
    it('should validate individual feed configurations', () => {
      console.log('🧪 Testing individual feed validation...');
      
      const testFeed = PRODUCTION_FEEDS[0];
      const result = validateFeedConfig(testFeed);
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
      
      console.log(`✅ Individual feed validation works for ${testFeed.name}`);
    });
    
    it('should detect invalid feed configurations', () => {
      console.log('🧪 Testing invalid feed detection...');
      
      const invalidFeed = {
        id: '',  // Invalid: empty ID
        name: 'Test Feed',
        url: 'not-a-url',  // Invalid: not a URL
        description: 'Test description',
        category: 'InvalidCategory',  // Invalid: not in category mapping
        language: 'en',
        tags: [],
        syncInterval: 'invalid' as any,  // Invalid: not a valid interval
        priority: 'invalid' as any,  // Invalid: not a valid priority
        enabled: true,
        popularity_score: 150,  // Invalid: out of range
        is_featured: false
      };
      
      const result = validateFeedConfig(invalidFeed);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      console.log(`✅ Invalid feed detection works: ${result.errors.length} errors found`);
    });
  });
  
  describe('3. Production Feed Workflow', () => {
    it('should handle production feed workflow end-to-end', () => {
      console.log('🧪 Testing end-to-end production feed workflow...');
      
      // 1. Get high priority feeds
      const highPriorityFeeds = getFeedsByPriority('high');
      expect(highPriorityFeeds.length).toBeGreaterThan(0);
      
      // 2. Validate feeds
      const validation = validateAllFeeds();
      expect(validation.summary.invalid).toBe(0);
      
      // 3. Convert to recommended feed format
      const recommendedFeeds = highPriorityFeeds.map(convertToRecommendedFeed);
      expect(recommendedFeeds.length).toBe(highPriorityFeeds.length);
      
      // 4. Verify all conversions are valid
      recommendedFeeds.forEach(feed => {
        expect(feed.id).toBeTruthy();
        expect(feed.name).toBeTruthy();
        expect(feed.url).toBeTruthy();
        expect(feed.category).toBeTruthy();
      });
      
      console.log('✅ End-to-end workflow completed successfully');
      console.log(`   Processed ${highPriorityFeeds.length} high priority feeds`);
    });
  });
  
  describe('4. Performance and Scalability', () => {
    it('should handle large feed lists efficiently', () => {
      console.log('🧪 Testing performance with large feed lists...');
      
      const startTime = Date.now();
      
      // Test validation performance
      const validation = validateAllFeeds();
      
      const validationTime = Date.now() - startTime;
      
      expect(validationTime).toBeLessThan(1000); // Should complete within 1 second
      expect(validation.summary.total).toBe(PRODUCTION_FEEDS.length);
      
      console.log(`✅ Performance test passed: ${validationTime}ms for ${PRODUCTION_FEEDS.length} feeds`);
    });
    
    it('should filter feeds efficiently', () => {
      console.log('🧪 Testing feed filtering performance...');
      
      const startTime = Date.now();
      
      // Test multiple filtering operations
      const highPriority = getFeedsByPriority('high');
      const mediumPriority = getFeedsByPriority('medium');
      const lowPriority = getFeedsByPriority('low');
      const hourlyFeeds = getFeedsBySyncInterval('hourly');
      const enabledFeeds = getEnabledFeeds();
      
      const filterTime = Date.now() - startTime;
      
      expect(filterTime).toBeLessThan(100); // Should complete within 100ms
      expect(highPriority.length + mediumPriority.length + lowPriority.length).toBeLessThanOrEqual(PRODUCTION_FEEDS.length);
      
      console.log(`✅ Filtering performance test passed: ${filterTime}ms`);
      console.log(`   Results: ${highPriority.length} high, ${mediumPriority.length} medium, ${lowPriority.length} low priority`);
    });
  });
});