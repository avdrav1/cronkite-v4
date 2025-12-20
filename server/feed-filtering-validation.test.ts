/**
 * Feed Filtering Logic Validation Tests
 * 
 * Comprehensive test suite for validating feed filtering logic
 * across all scenarios as required by task 5.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FeedFilteringValidator, type FilterOptions, validateFilterOptions } from './feed-filtering-validation';
import { type RecommendedFeed } from '@shared/schema';

// Mock feed data for testing
const createMockFeeds = (): RecommendedFeed[] => [
  {
    id: 'tech-1',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    site_url: 'https://techcrunch.com',
    description: 'Technology news and startups',
    icon_url: 'https://techcrunch.com/favicon.ico',
    category: 'Technology',
    country: 'US',
    language: 'en',
    tags: ['technology', 'startups'],
    popularity_score: 95,
    article_frequency: 'hourly',
    is_featured: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'tech-2',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    site_url: 'https://www.theverge.com',
    description: 'Technology, science, art, and culture',
    icon_url: 'https://www.theverge.com/favicon.ico',
    category: 'Technology',
    country: 'US',
    language: 'en',
    tags: ['technology', 'science'],
    popularity_score: 90,
    article_frequency: 'daily',
    is_featured: false,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'news-1',
    name: 'BBC News',
    url: 'http://feeds.bbci.co.uk/news/rss.xml',
    site_url: 'https://www.bbc.com/news',
    description: 'Breaking news from around the world',
    icon_url: 'https://www.bbc.com/favicon.ico',
    category: 'News',
    country: 'UK',
    language: 'en',
    tags: ['news', 'world'],
    popularity_score: 98,
    article_frequency: 'hourly',
    is_featured: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'business-1',
    name: 'Wall Street Journal',
    url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
    site_url: 'https://www.wsj.com',
    description: 'Business and financial news',
    icon_url: 'https://www.wsj.com/favicon.ico',
    category: 'Business',
    country: 'US',
    language: 'en',
    tags: ['business', 'finance'],
    popularity_score: 92,
    article_frequency: 'hourly',
    is_featured: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 'science-1',
    name: 'Nature',
    url: 'https://www.nature.com/nature.rss',
    site_url: 'https://www.nature.com',
    description: 'International journal of science',
    icon_url: 'https://www.nature.com/favicon.ico',
    category: 'Science',
    country: 'UK',
    language: 'en',
    tags: ['science', 'research'],
    popularity_score: 87,
    article_frequency: 'weekly',
    is_featured: false,
    created_at: new Date(),
    updated_at: new Date()
  }
];

describe('Feed Filtering Logic Validation', () => {
  let mockFeeds: RecommendedFeed[];

  beforeEach(() => {
    mockFeeds = createMockFeeds();
  });

  describe('Interest-based filtering (Requirement 1.1)', () => {
    it('should filter feeds by single interest correctly', () => {
      const result = FeedFilteringValidator.validateInterestFiltering(
        mockFeeds, 
        ['tech'] // Use frontend category 'tech' which maps to 'Technology'
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(2); // TechCrunch and The Verge
      expect(result.errors).toHaveLength(0);
      expect(result.appliedFilters[0]).toMatch(/interest-filter-mapped \(\d+ frontend → \d+ database\)/);
    });

    it('should filter feeds by multiple interests correctly', () => {
      const result = FeedFilteringValidator.validateInterestFiltering(
        mockFeeds, 
        ['tech', 'news', 'science'] // Use frontend categories
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(4); // Tech (2) + News (1) + Science (1)
      expect(result.errors).toHaveLength(0);
      expect(result.appliedFilters[0]).toMatch(/interest-filter-mapped \(\d+ frontend → \d+ database\)/);
    });

    it('should handle case-insensitive interest matching', () => {
      const result = FeedFilteringValidator.validateInterestFiltering(
        mockFeeds, 
        ['tech', 'NEWS'] // Mix of cases - should still work with mapping
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(3); // Tech (2) + News (1)
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty interest selection (Requirement 3.5)', () => {
      const result = FeedFilteringValidator.validateInterestFiltering(
        mockFeeds, 
        []
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(mockFeeds.length); // All feeds
      expect(result.warnings).toContain('No interests selected - returning all feeds');
      expect(result.appliedFilters).toContain('no-filter (empty interests)');
    });

    it('should warn about non-existent interests', () => {
      const result = FeedFilteringValidator.validateInterestFiltering(
        mockFeeds, 
        ['tech', 'NonExistentCategory'] // Mix of valid and invalid
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(2); // Only tech feeds
      expect(result.warnings.some(w => w.includes('NonExistentCategory'))).toBe(true);
    });

    it('should handle unmapped categories gracefully', () => {
      const result = FeedFilteringValidator.validateInterestFiltering(
        mockFeeds, 
        ['NonExistentCategory1', 'NonExistentCategory2']
      );

      expect(result.isValid).toBe(true); // This is valid behavior - no mappings found
      expect(result.filteredCount).toBe(0);
      expect(result.warnings.some(w => w.includes('No valid category mappings found'))).toBe(true);
    });
  });

  describe('Comprehensive filtering (Requirement 3.4)', () => {
    it('should apply multiple filters consistently', () => {
      const options: FilterOptions = {
        interests: ['tech'], // Use frontend category
        featured: true,
        country: 'US'
      };

      const result = FeedFilteringValidator.validateComprehensiveFiltering(
        mockFeeds, 
        options
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(1); // Only TechCrunch (featured + US + tech->Technology)
      expect(result.appliedFilters).toContain('interests-mapped (1 frontend → 1 database)');
      expect(result.appliedFilters).toContain('featured (true)');
      expect(result.appliedFilters).toContain('country (US)');
    });

    it('should handle search filtering correctly', () => {
      const options: FilterOptions = {
        search: 'science'
      };

      const result = FeedFilteringValidator.validateComprehensiveFiltering(
        mockFeeds, 
        options
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(2); // The Verge (description) + Nature (tags)
      expect(result.appliedFilters).toContain('search ("science")');
    });

    it('should apply limit correctly', () => {
      const options: FilterOptions = {
        interests: ['tech'], // Use frontend category
        limit: 1
      };

      const result = FeedFilteringValidator.validateComprehensiveFiltering(
        mockFeeds, 
        options
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(1); // Limited to 1 feed
      expect(result.appliedFilters).toContain('interests-mapped (1 frontend → 1 database)');
      expect(result.appliedFilters).toContain('limit (1)');
    });

    it('should validate that filtered count never exceeds original count', () => {
      // This test ensures our validation logic catches impossible scenarios
      const options: FilterOptions = {
        interests: ['tech', 'news', 'business', 'science'] // Use frontend categories
      };

      const result = FeedFilteringValidator.validateComprehensiveFiltering(
        mockFeeds, 
        options
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBeLessThanOrEqual(result.originalCount);
    });

    it('should handle language filtering', () => {
      const options: FilterOptions = {
        language: 'en'
      };

      const result = FeedFilteringValidator.validateComprehensiveFiltering(
        mockFeeds, 
        options
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(mockFeeds.length); // All feeds are English
      expect(result.appliedFilters).toContain('language (en)');
    });
  });

  describe('Filtering consistency validation', () => {
    it('should detect consistent results for identical scenarios', () => {
      const scenarios: FilterOptions[] = [
        { interests: ['tech'] }, // Use frontend category
        { interests: ['tech'] }, // Identical
        { interests: ['news'] },
        { interests: ['news'] } // Identical
      ];

      const result = FeedFilteringValidator.validateFilteringConsistency(
        mockFeeds, 
        scenarios
      );

      expect(result.isConsistent).toBe(true);
      expect(result.inconsistencies).toHaveLength(0);
    });

    it('should validate empty interests scenarios return all feeds', () => {
      const scenarios: FilterOptions[] = [
        { interests: [] },
        {}, // No interests specified
        { interests: undefined }
      ];

      const result = FeedFilteringValidator.validateFilteringConsistency(
        mockFeeds, 
        scenarios
      );

      expect(result.isConsistent).toBe(true);
      expect(result.inconsistencies).toHaveLength(0);
    });
  });

  describe('Frontend-backend consistency validation', () => {
    it('should validate consistent results with category mapping', () => {
      // Both frontend and backend now use category mapping, so they should be consistent
      const selectedInterests = ['tech']; // Use correct frontend category

      const result = FeedFilteringValidator.validateFrontendBackendConsistency(
        mockFeeds, 
        selectedInterests
      );

      // Both should now be consistent since they use the same mapping logic
      expect(result.isConsistent).toBe(true);
      expect(result.differences.length).toBe(0);
    });

    it('should validate consistent results when cases match', () => {
      const selectedInterests = ['tech']; // Use correct frontend category

      const result = FeedFilteringValidator.validateFrontendBackendConsistency(
        mockFeeds, 
        selectedInterests
      );

      expect(result.isConsistent).toBe(true);
      expect(result.differences).toHaveLength(0);
    });
  });

  describe('Filter options validation', () => {
    it('should validate correct filter options', () => {
      const options: FilterOptions = {
        interests: ['tech'], // Use frontend category
        search: 'tech',
        limit: 10,
        country: 'US',
        language: 'en'
      };

      const result = validateFilterOptions(options);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid limit values', () => {
      const options: FilterOptions = {
        limit: -1
      };

      const result = validateFilterOptions(options);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Limit must be between 0 and 1000');
    });

    it('should reject overly long search queries', () => {
      const options: FilterOptions = {
        search: 'a'.repeat(101) // 101 characters
      };

      const result = validateFilterOptions(options);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Search query must be 100 characters or less');
    });

    it('should reject invalid country codes', () => {
      const options: FilterOptions = {
        country: 'X' // Too short
      };

      const result = validateFilterOptions(options);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Country code must be 2-3 characters');
    });

    it('should reject invalid language codes', () => {
      const options: FilterOptions = {
        language: 'x' // Too short
      };

      const result = validateFilterOptions(options);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Language code must be at least 2 characters');
    });
  });

  describe('Edge cases and error conditions', () => {
    it('should handle empty feed list', () => {
      const result = FeedFilteringValidator.validateInterestFiltering(
        [], 
        ['tech'] // Use frontend category
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(0);
      expect(result.originalCount).toBe(0);
    });

    it('should handle feeds with missing optional fields', () => {
      const feedsWithMissingFields: RecommendedFeed[] = [
        {
          id: 'minimal-1',
          name: 'Minimal Feed',
          url: 'https://example.com/feed.xml',
          site_url: null,
          description: null,
          icon_url: null,
          category: 'Technology',
          country: 'US',
          language: 'en',
          tags: null,
          popularity_score: 50,
          article_frequency: 'daily',
          is_featured: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const result = FeedFilteringValidator.validateComprehensiveFiltering(
        feedsWithMissingFields, 
        { search: 'minimal' }
      );

      expect(result.isValid).toBe(true);
      expect(result.filteredCount).toBe(1); // Should find by name
    });

    it('should handle special characters in search queries', () => {
      const options: FilterOptions = {
        search: 'tech & science!'
      };

      const result = FeedFilteringValidator.validateComprehensiveFiltering(
        mockFeeds, 
        options
      );

      expect(result.isValid).toBe(true);
      // Should not crash and should handle special characters gracefully
    });
  });
});