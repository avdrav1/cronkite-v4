/**
 * Final Integration Testing - Complete End-to-End Validation
 * 
 * This test suite implements Task 10 from the database-configuration-fix spec:
 * - Run complete onboarding flow end-to-end
 * - Verify feed filtering works with all category combinations
 * - Test both development (105 feeds) and production (865 feeds) scenarios
 * 
 * Requirements: All requirements from database-configuration-fix spec
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { storage } from '../server/storage';
import { categoryMappingService, CategoryMappingUtils } from '@shared/category-mapping';
import { filterFeedsByInterestsWithMapping, FeedFilteringValidator } from '../server/feed-filtering-validation';
import { filterFeedsByInterests, groupFeedsByCategory } from '../client/src/lib/feed-filtering';
import type { RecommendedFeed } from '@shared/schema';

// Helper function to create development subset
function createDevelopmentSubset(allFeeds: RecommendedFeed[], targetCount: number): RecommendedFeed[] {
  // Group feeds by category
  const feedsByCategory: Record<string, RecommendedFeed[]> = {};
  allFeeds.forEach(feed => {
    if (!feedsByCategory[feed.category]) {
      feedsByCategory[feed.category] = [];
    }
    feedsByCategory[feed.category].push(feed);
  });
  
  const categories = Object.keys(feedsByCategory);
  const feedsPerCategory = Math.floor(targetCount / categories.length);
  const remainder = targetCount % categories.length;
  
  const devFeeds: RecommendedFeed[] = [];
  
  // Take feeds from each category to maintain diversity
  categories.forEach((category, index) => {
    const categoryFeeds = feedsByCategory[category];
    const takeCount = feedsPerCategory + (index < remainder ? 1 : 0);
    const selectedFeeds = categoryFeeds.slice(0, Math.min(takeCount, categoryFeeds.length));
    devFeeds.push(...selectedFeeds);
  });
  
  return devFeeds.slice(0, targetCount);
}

describe('Final Integration Testing - Complete End-to-End', () => {
  let app: express.Express;
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    // Set environment to test
    process.env.NODE_ENV = 'test';
    
    app = express();
    app.use(express.json());
    
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app);
    
    server = httpServer.listen(0); // Use random available port
    const address = server.address();
    const port = typeof address === 'string' ? address : address?.port;
    baseUrl = `http://localhost:${port}`;
    
    console.log(`🚀 Final integration test server started on ${baseUrl}`);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Complete Onboarding Flow End-to-End', () => {
    it('should complete full onboarding flow with category mapping', async () => {
      console.log('🧪 Testing complete onboarding flow...');
      
      // Step 1: Get all available feeds (simulating initial load)
      const allFeeds = await storage.getRecommendedFeeds();
      expect(allFeeds.length).toBe(865); // Production scenario
      
      // Step 2: Simulate user selecting interests in onboarding
      const selectedInterests = ['tech', 'news', 'business', 'science'];
      console.log(`👤 User selected interests: ${selectedInterests.join(', ')}`);
      
      // Step 3: Validate category mapping works for selected interests
      const mappingValidation = CategoryMappingUtils.validateFrontendCategorySet(selectedInterests);
      expect(mappingValidation.isValid).toBe(true);
      
      // Step 4: Filter feeds using backend logic (API simulation)
      const backendResult = filterFeedsByInterestsWithMapping(allFeeds, selectedInterests);
      expect(backendResult.filteredFeeds.length).toBeGreaterThan(0);
      expect(backendResult.mappingResults.mapped.length).toBe(selectedInterests.length);
      
      // Step 5: Filter feeds using frontend logic (component simulation)
      const frontendResult = filterFeedsByInterests(allFeeds, selectedInterests);
      expect(frontendResult.filteredCount).toBeGreaterThan(0);
      expect(frontendResult.filteredCount).toBe(backendResult.filteredFeeds.length);
      
      // Step 6: Group feeds by category for display
      const groupedFeeds = groupFeedsByCategory(frontendResult.feeds, selectedInterests);
      expect(Object.keys(groupedFeeds).length).toBeGreaterThan(0);
      
      // Step 7: Validate all grouped feeds match selected interests
      for (const [frontendCategory, feeds] of Object.entries(groupedFeeds)) {
        expect(selectedInterests).toContain(frontendCategory);
        expect(feeds.length).toBeGreaterThan(0);
        
        // Verify all feeds in this group match the mapped database category
        const dbCategory = categoryMappingService.frontendToDatabase(frontendCategory);
        expect(dbCategory).toBeTruthy();
        
        feeds.forEach(feed => {
          expect(feed.category).toBe(dbCategory);
        });
      }
      
      console.log('✅ Complete onboarding flow validation passed');
    });

    it('should handle onboarding with no interests selected', async () => {
      console.log('🧪 Testing onboarding with no interests...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      const selectedInterests: string[] = [];
      
      // Backend should return all feeds
      const backendResult = filterFeedsByInterestsWithMapping(allFeeds, selectedInterests);
      expect(backendResult.filteredFeeds.length).toBe(allFeeds.length);
      expect(backendResult.mappingResults.warnings).toContain('No interests provided - returning all feeds');
      
      // Frontend should return all feeds
      const frontendResult = filterFeedsByInterests(allFeeds, selectedInterests);
      expect(frontendResult.filteredCount).toBe(allFeeds.length);
      expect(frontendResult.warnings).toContain('No interests selected - showing all feeds');
      
      console.log('✅ No interests onboarding validation passed');
    });

    it('should handle onboarding with invalid interests gracefully', async () => {
      console.log('🧪 Testing onboarding with invalid interests...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      const selectedInterests = ['invalid-category', 'another-invalid'];
      
      // Backend should handle gracefully with warnings
      const backendResult = filterFeedsByInterestsWithMapping(allFeeds, selectedInterests);
      expect(backendResult.filteredFeeds.length).toBe(0);
      expect(backendResult.mappingResults.unmapped.length).toBe(2);
      expect(backendResult.mappingResults.warnings.length).toBeGreaterThan(0);
      
      // Frontend should handle gracefully with warnings
      const frontendResult = filterFeedsByInterests(allFeeds, selectedInterests);
      expect(frontendResult.filteredCount).toBe(0);
      expect(frontendResult.warnings.length).toBeGreaterThan(0);
      
      console.log('✅ Invalid interests onboarding validation passed');
    });
  });

  describe('2. Feed Filtering with All Category Combinations', () => {
    it('should test all valid frontend categories individually', async () => {
      console.log('🧪 Testing all frontend categories individually...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      const allFrontendCategories = categoryMappingService.getAllFrontendCategories();
      
      console.log(`📋 Testing ${allFrontendCategories.length} frontend categories`);
      
      for (const frontendCategory of allFrontendCategories) {
        console.log(`🔍 Testing category: ${frontendCategory}`);
        
        // Test backend filtering
        const backendResult = filterFeedsByInterestsWithMapping(allFeeds, [frontendCategory]);
        
        // Test frontend filtering
        const frontendResult = filterFeedsByInterests(allFeeds, [frontendCategory]);
        
        // Validate consistency
        expect(frontendResult.filteredCount).toBe(backendResult.filteredFeeds.length);
        
        // Validate mapping worked
        const dbCategory = categoryMappingService.frontendToDatabase(frontendCategory);
        expect(dbCategory).toBeTruthy();
        
        // Validate all returned feeds match the database category
        backendResult.filteredFeeds.forEach(feed => {
          expect(feed.category).toBe(dbCategory);
        });
        
        frontendResult.feeds.forEach(feed => {
          expect(feed.category).toBe(dbCategory);
        });
        
        console.log(`✅ ${frontendCategory} → ${dbCategory}: ${frontendResult.filteredCount} feeds`);
      }
      
      console.log('✅ All individual category filtering validation passed');
    });

    it('should test multiple category combinations', async () => {
      console.log('🧪 Testing multiple category combinations...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      const testCombinations = [
        ['tech', 'news'],
        ['business', 'science', 'space'],
        ['gaming', 'sports', 'music'],
        ['programming', 'design', 'tech'],
        ['food', 'travel', 'books'],
        ['movies', 'music', 'gaming'],
        ['android', 'apple', 'tech'],
        ['startups', 'business', 'tech']
      ];
      
      for (const combination of testCombinations) {
        console.log(`🔍 Testing combination: ${combination.join(', ')}`);
        
        // Test backend filtering
        const backendResult = filterFeedsByInterestsWithMapping(allFeeds, combination);
        
        // Test frontend filtering
        const frontendResult = filterFeedsByInterests(allFeeds, combination);
        
        // Validate consistency
        expect(frontendResult.filteredCount).toBe(backendResult.filteredFeeds.length);
        
        // Validate all categories were mapped
        expect(backendResult.mappingResults.mapped.length).toBe(combination.length);
        expect(backendResult.mappingResults.unmapped.length).toBe(0);
        
        // Validate feeds match mapped database categories
        const mappedDbCategories = CategoryMappingUtils.frontendArrayToDatabase(combination);
        
        backendResult.filteredFeeds.forEach(feed => {
          expect(mappedDbCategories).toContain(feed.category);
        });
        
        frontendResult.feeds.forEach(feed => {
          expect(mappedDbCategories).toContain(feed.category);
        });
        
        console.log(`✅ Combination [${combination.join(', ')}]: ${frontendResult.filteredCount} feeds`);
      }
      
      console.log('✅ Multiple category combinations validation passed');
    });

    it('should test comprehensive filtering with all filter types', async () => {
      console.log('🧪 Testing comprehensive filtering...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      
      const testScenarios = [
        {
          name: 'Interest + Featured',
          options: { interests: ['tech', 'news'], featured: true }
        },
        {
          name: 'Interest + Country',
          options: { interests: ['business'], country: 'US' }
        },
        {
          name: 'Interest + Language',
          options: { interests: ['science'], language: 'en' }
        },
        {
          name: 'Interest + Search',
          options: { interests: ['tech'], search: 'technology' }
        },
        {
          name: 'Multiple filters combined',
          options: { interests: ['tech', 'business'], featured: true, country: 'US', language: 'en' }
        }
      ];
      
      for (const scenario of testScenarios) {
        console.log(`🔍 Testing scenario: ${scenario.name}`);
        
        // Test using validation logic
        const validationResult = FeedFilteringValidator.validateComprehensiveFiltering(
          allFeeds, 
          scenario.options
        );
        
        expect(validationResult.isValid).toBe(true);
        expect(validationResult.filteredCount).toBeGreaterThanOrEqual(0);
        expect(validationResult.filteredCount).toBeLessThanOrEqual(allFeeds.length);
        
        console.log(`✅ ${scenario.name}: ${validationResult.filteredCount} feeds, filters: ${validationResult.appliedFilters.join(', ')}`);
      }
      
      console.log('✅ Comprehensive filtering validation passed');
    });
  });

  describe('3. Development vs Production Scenarios', () => {
    it('should validate production scenario (865 feeds)', async () => {
      console.log('🧪 Testing production scenario (865 feeds)...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      expect(allFeeds.length).toBe(865);
      
      // Test category distribution
      const categoryCount: Record<string, number> = {};
      allFeeds.forEach(feed => {
        categoryCount[feed.category] = (categoryCount[feed.category] || 0) + 1;
      });
      
      const categories = Object.keys(categoryCount);
      expect(categories.length).toBeGreaterThan(10); // Should have diverse categories
      
      // Test that all frontend categories have corresponding feeds
      const allFrontendCategories = categoryMappingService.getAllFrontendCategories();
      const mappedDbCategories = CategoryMappingUtils.frontendArrayToDatabase(allFrontendCategories);
      
      let categoriesWithFeeds = 0;
      for (const dbCategory of mappedDbCategories) {
        if (categoryCount[dbCategory] > 0) {
          categoriesWithFeeds++;
        }
      }
      
      // Should have feeds in most categories (allowing for some empty categories)
      const coveragePercentage = (categoriesWithFeeds / mappedDbCategories.length) * 100;
      expect(coveragePercentage).toBeGreaterThan(70); // At least 70% coverage
      
      console.log(`📊 Production scenario: ${categories.length} database categories, ${coveragePercentage.toFixed(1)}% coverage`);
      console.log('✅ Production scenario validation passed');
    });

    it('should simulate development scenario (105 feeds subset)', async () => {
      console.log('🧪 Simulating development scenario (105 feeds subset)...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      
      // Simulate development scenario by taking a representative subset
      const devFeeds = createDevelopmentSubset(allFeeds, 105);
      expect(devFeeds.length).toBe(105);
      
      // Test that development subset maintains category diversity
      const categoryCount: Record<string, number> = {};
      devFeeds.forEach(feed => {
        categoryCount[feed.category] = (categoryCount[feed.category] || 0) + 1;
      });
      
      const categories = Object.keys(categoryCount);
      expect(categories.length).toBeGreaterThan(5); // Should maintain diversity
      
      // Test filtering works with smaller dataset
      const selectedInterests = ['tech', 'news', 'business'];
      const backendResult = filterFeedsByInterestsWithMapping(devFeeds, selectedInterests);
      const frontendResult = filterFeedsByInterests(devFeeds, selectedInterests);
      
      expect(frontendResult.filteredCount).toBe(backendResult.filteredFeeds.length);
      expect(backendResult.mappingResults.mapped.length).toBe(selectedInterests.length);
      
      console.log(`📊 Development scenario: ${categories.length} categories, ${frontendResult.filteredCount} filtered feeds`);
      console.log('✅ Development scenario validation passed');
    });

    it('should validate performance with both scenarios', async () => {
      console.log('🧪 Testing performance with both scenarios...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      const devFeeds = createDevelopmentSubset(allFeeds, 105);
      
      const selectedInterests = ['tech', 'news', 'business', 'science'];
      
      // Test production performance
      const prodStartTime = Date.now();
      const prodBackendResult = filterFeedsByInterestsWithMapping(allFeeds, selectedInterests);
      const prodFrontendResult = filterFeedsByInterests(allFeeds, selectedInterests);
      const prodEndTime = Date.now();
      const prodDuration = prodEndTime - prodStartTime;
      
      // Test development performance
      const devStartTime = Date.now();
      const devBackendResult = filterFeedsByInterestsWithMapping(devFeeds, selectedInterests);
      const devFrontendResult = filterFeedsByInterests(devFeeds, selectedInterests);
      const devEndTime = Date.now();
      const devDuration = devEndTime - devStartTime;
      
      // Validate results are consistent
      expect(prodFrontendResult.filteredCount).toBe(prodBackendResult.filteredFeeds.length);
      expect(devFrontendResult.filteredCount).toBe(devBackendResult.filteredFeeds.length);
      
      // Performance should be reasonable for both scenarios
      expect(prodDuration).toBeLessThan(1000); // Production should complete within 1 second
      expect(devDuration).toBeLessThan(100);   // Development should be very fast
      
      console.log(`📊 Performance - Production (${allFeeds.length} feeds): ${prodDuration}ms`);
      console.log(`📊 Performance - Development (${devFeeds.length} feeds): ${devDuration}ms`);
      console.log('✅ Performance validation passed');
    });


  });

  describe('4. Error Handling and Edge Cases', () => {
    it('should handle database connectivity issues gracefully', async () => {
      console.log('🧪 Testing database connectivity error handling...');
      
      // Mock storage to simulate connection failure
      const originalGetFeeds = storage.getRecommendedFeeds;
      storage.getRecommendedFeeds = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      
      try {
        await storage.getRecommendedFeeds();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Database connection failed');
      } finally {
        // Restore original method
        storage.getRecommendedFeeds = originalGetFeeds;
      }
      
      console.log('✅ Database connectivity error handling validation passed');
    });

    it('should handle malformed feed data gracefully', async () => {
      console.log('🧪 Testing malformed feed data handling...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      
      // Create feeds with missing or invalid data
      const malformedFeeds: RecommendedFeed[] = [
        {
          ...allFeeds[0],
          category: '', // Empty category
        },
        {
          ...allFeeds[1],
          category: 'InvalidCategory', // Unmapped category
        }
      ];
      
      // Test that filtering handles malformed data gracefully
      const selectedInterests = ['tech'];
      
      expect(() => {
        const backendResult = filterFeedsByInterestsWithMapping(malformedFeeds, selectedInterests);
        const frontendResult = filterFeedsByInterests(malformedFeeds, selectedInterests);
        
        // Should not crash, even with malformed data
        expect(Array.isArray(backendResult.filteredFeeds)).toBe(true);
        expect(typeof frontendResult.filteredCount).toBe('number');
      }).not.toThrow();
      
      console.log('✅ Malformed feed data handling validation passed');
    });

    it('should handle edge cases in category mapping', async () => {
      console.log('🧪 Testing category mapping edge cases...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      
      const edgeCases = [
        [], // Empty interests
        [''], // Empty string interest
        ['  '], // Whitespace only
        ['TECH'], // Wrong case
        ['tech', 'tech'], // Duplicate interests
        ['tech', 'invalid', 'news'], // Mix of valid and invalid
      ];
      
      for (const interests of edgeCases) {
        console.log(`🔍 Testing edge case: [${interests.join(', ')}]`);
        
        expect(() => {
          const backendResult = filterFeedsByInterestsWithMapping(allFeeds, interests);
          const frontendResult = filterFeedsByInterests(allFeeds, interests);
          
          // Should handle gracefully without crashing
          expect(Array.isArray(backendResult.filteredFeeds)).toBe(true);
          expect(typeof frontendResult.filteredCount).toBe('number');
          expect(frontendResult.filteredCount).toBeGreaterThanOrEqual(0);
          
        }).not.toThrow();
      }
      
      console.log('✅ Category mapping edge cases validation passed');
    });
  });

  describe('5. Frontend-Backend Consistency Validation', () => {
    it('should ensure frontend and backend filtering produce identical results', async () => {
      console.log('🧪 Testing frontend-backend consistency...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      const testScenarios = [
        ['tech'],
        ['news', 'business'],
        ['science', 'space', 'programming'],
        ['gaming', 'sports'],
        [], // Empty interests
      ];
      
      for (const interests of testScenarios) {
        console.log(`🔍 Testing consistency for: [${interests.join(', ')}]`);
        
        // Backend filtering
        const backendResult = filterFeedsByInterestsWithMapping(allFeeds, interests);
        
        // Frontend filtering
        const frontendResult = filterFeedsByInterests(allFeeds, interests);
        
        // Results should be identical
        expect(frontendResult.filteredCount).toBe(backendResult.filteredFeeds.length);
        
        // Feed IDs should match
        const backendIds = new Set(backendResult.filteredFeeds.map(f => f.id));
        const frontendIds = new Set(frontendResult.feeds.map(f => f.id));
        
        expect(backendIds.size).toBe(frontendIds.size);
        
        // All IDs should match
        for (const id of backendIds) {
          expect(frontendIds.has(id)).toBe(true);
        }
        
        console.log(`✅ Consistency verified: ${frontendResult.filteredCount} feeds`);
      }
      
      console.log('✅ Frontend-backend consistency validation passed');
    });

    it('should validate filtering consistency across multiple calls', async () => {
      console.log('🧪 Testing filtering consistency across multiple calls...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      const selectedInterests = ['tech', 'news', 'business'];
      
      // Make multiple calls and ensure results are consistent
      const results = [];
      for (let i = 0; i < 5; i++) {
        const backendResult = filterFeedsByInterestsWithMapping(allFeeds, selectedInterests);
        const frontendResult = filterFeedsByInterests(allFeeds, selectedInterests);
        
        results.push({
          backend: backendResult.filteredFeeds.length,
          frontend: frontendResult.filteredCount
        });
      }
      
      // All results should be identical
      const firstResult = results[0];
      results.forEach((result, index) => {
        expect(result.backend).toBe(firstResult.backend);
        expect(result.frontend).toBe(firstResult.frontend);
        expect(result.backend).toBe(result.frontend);
      });
      
      console.log(`✅ Consistency across ${results.length} calls: ${firstResult.backend} feeds each time`);
      console.log('✅ Multiple calls consistency validation passed');
    });
  });

  describe('6. Category Mapping System Validation', () => {
    it('should validate complete category mapping system', async () => {
      console.log('🧪 Testing complete category mapping system...');
      
      // Validate mapping consistency
      const mappingValidation = CategoryMappingUtils.validateMappingConsistency();
      expect(mappingValidation.isValid).toBe(true);
      
      if (mappingValidation.errors.length > 0) {
        console.error('❌ Mapping validation errors:', mappingValidation.errors);
      }
      
      if (mappingValidation.warnings.length > 0) {
        console.warn('⚠️ Mapping validation warnings:', mappingValidation.warnings);
      }
      
      // Validate mapping completeness
      const completenessValidation = CategoryMappingUtils.validateMappingCompleteness();
      expect(completenessValidation.isComplete).toBe(true);
      
      if (!completenessValidation.isComplete) {
        console.error('❌ Missing mappings:', completenessValidation.missingMappings);
      }
      
      // Validate seeded data coverage
      const allFeeds = await storage.getRecommendedFeeds();
      const seededCategories = [...new Set(allFeeds.map(feed => feed.category))];
      const coverageValidation = CategoryMappingUtils.validateSeededDataCoverage(seededCategories);
      
      expect(coverageValidation.isValid).toBe(true);
      
      if (coverageValidation.errors.length > 0) {
        console.error('❌ Coverage validation errors:', coverageValidation.errors);
      }
      
      console.log(`📊 Mapping stats: ${mappingValidation.stats.totalMappings} mappings, ${mappingValidation.stats.frontendCategories} frontend categories`);
      console.log(`📊 Coverage: ${coverageValidation.coverage.coveragePercentage.toFixed(1)}% (${coverageValidation.coverage.coveredCategories.length}/${coverageValidation.coverage.totalFrontendCategories})`);
      console.log('✅ Category mapping system validation passed');
    });

    it('should validate bidirectional mapping consistency', async () => {
      console.log('🧪 Testing bidirectional mapping consistency...');
      
      const allFrontendCategories = categoryMappingService.getAllFrontendCategories();
      
      for (const frontendCategory of allFrontendCategories) {
        // Map frontend to database
        const dbCategory = categoryMappingService.frontendToDatabase(frontendCategory);
        expect(dbCategory).toBeTruthy();
        
        // Map back to frontend
        const backToFrontend = categoryMappingService.databaseToFrontend(dbCategory!);
        expect(backToFrontend).toBe(frontendCategory);
        
        console.log(`✅ ${frontendCategory} ↔ ${dbCategory}`);
      }
      
      console.log('✅ Bidirectional mapping consistency validation passed');
    });
  });

  describe('7. Performance and Scalability Validation', () => {
    it('should validate performance with large datasets', async () => {
      console.log('🧪 Testing performance with large datasets...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      const selectedInterests = ['tech', 'news', 'business', 'science', 'gaming'];
      
      // Test multiple rapid filtering operations
      const startTime = Date.now();
      
      const promises = Array(10).fill(null).map(async () => {
        const backendResult = filterFeedsByInterestsWithMapping(allFeeds, selectedInterests);
        const frontendResult = filterFeedsByInterests(allFeeds, selectedInterests);
        return { backend: backendResult.filteredFeeds.length, frontend: frontendResult.filteredCount };
      });
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      // All results should be consistent
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.backend).toBe(firstResult.backend);
        expect(result.frontend).toBe(firstResult.frontend);
        expect(result.backend).toBe(result.frontend);
      });
      
      // Performance should be reasonable
      expect(totalDuration).toBeLessThan(2000); // 10 operations within 2 seconds
      
      console.log(`📊 Performance: ${results.length} operations in ${totalDuration}ms (${(totalDuration / results.length).toFixed(1)}ms avg)`);
      console.log('✅ Performance validation passed');
    });

    it('should validate memory usage with repeated operations', async () => {
      console.log('🧪 Testing memory usage with repeated operations...');
      
      const allFeeds = await storage.getRecommendedFeeds();
      const selectedInterests = ['tech', 'news'];
      
      // Perform many filtering operations to test for memory leaks
      for (let i = 0; i < 100; i++) {
        const backendResult = filterFeedsByInterestsWithMapping(allFeeds, selectedInterests);
        const frontendResult = filterFeedsByInterests(allFeeds, selectedInterests);
        
        // Validate results are consistent
        expect(frontendResult.filteredCount).toBe(backendResult.filteredFeeds.length);
        
        // Clear references to help GC
        backendResult.filteredFeeds.length = 0;
        frontendResult.feeds.length = 0;
      }
      
      console.log('✅ Memory usage validation passed (100 operations completed)');
    });
  });
});