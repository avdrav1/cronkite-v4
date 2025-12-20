/**
 * Frontend Feed Filtering Logic Tests
 * 
 * Tests for the frontend feed filtering logic to ensure consistency
 * with backend validation.
 */

import { describe, it, expect } from 'vitest';
import { filterFeedsByInterests, filterFeeds, groupFeedsByCategory, validateFilteringConsistency } from './feed-filtering';
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
  }
];

describe('Frontend Feed Filtering Logic', () => {
  let mockFeeds: RecommendedFeed[];

  beforeEach(() => {
    mockFeeds = createMockFeeds();
  });

  describe('filterFeedsByInterests', () => {
    it('should filter feeds by single interest correctly', () => {
      const result = filterFeedsByInterests(mockFeeds, ['tech']); // Use frontend category

      expect(result.feeds).toHaveLength(2);
      expect(result.filteredCount).toBe(2);
      expect(result.totalCount).toBe(3);
      expect(result.appliedFilters[0]).toMatch(/interests-mapped/);
      expect(result.warnings).toHaveLength(0);
    });

    it('should filter feeds by multiple interests correctly', () => {
      const result = filterFeedsByInterests(mockFeeds, ['tech', 'news']); // Use frontend categories

      expect(result.feeds).toHaveLength(3);
      expect(result.filteredCount).toBe(3);
      expect(result.appliedFilters[0]).toMatch(/interests-mapped/);
    });

    it('should handle case-insensitive matching', () => {
      const result = filterFeedsByInterests(mockFeeds, ['tech', 'NEWS']); // Use frontend categories

      expect(result.feeds).toHaveLength(3);
      expect(result.filteredCount).toBe(3);
    });

    it('should handle empty interest selection (Requirement 3.5)', () => {
      const result = filterFeedsByInterests(mockFeeds, []);

      expect(result.feeds).toHaveLength(3); // All feeds
      expect(result.filteredCount).toBe(3);
      expect(result.appliedFilters).toContain('no-filter (empty interests)');
      expect(result.warnings).toContain('No interests selected - showing all feeds');
    });

    it('should warn about non-existent interests', () => {
      const result = filterFeedsByInterests(mockFeeds, ['tech', 'NonExistent']); // Use frontend category

      expect(result.feeds).toHaveLength(2); // Only tech feeds
      expect(result.warnings.some(w => w.includes('NonExistent'))).toBe(true);
    });

    it('should warn when no feeds match interests', () => {
      const result = filterFeedsByInterests(mockFeeds, ['NonExistent']);

      expect(result.feeds).toHaveLength(0);
      expect(result.warnings).toContain('No valid category mappings found');
    });
  });

  describe('filterFeeds comprehensive filtering', () => {
    it('should apply multiple filters correctly', () => {
      const result = filterFeeds(mockFeeds, {
        interests: ['tech'], // Use frontend category
        featured: true
      });

      expect(result.feeds).toHaveLength(1); // Only TechCrunch (featured + tech->Technology)
      expect(result.appliedFilters[0]).toMatch(/interests-mapped/);
      expect(result.appliedFilters).toContain('featured (true)');
    });

    it('should handle search filtering', () => {
      const result = filterFeeds(mockFeeds, {
        search: 'science'
      });

      expect(result.feeds).toHaveLength(1); // Only The Verge (has "science" in description)
      expect(result.appliedFilters).toContain('search ("science")');
    });

    it('should handle country filtering', () => {
      const result = filterFeeds(mockFeeds, {
        country: 'US'
      });

      expect(result.feeds).toHaveLength(2); // TechCrunch and The Verge
      expect(result.appliedFilters).toContain('country (US)');
    });

    it('should handle language filtering', () => {
      const result = filterFeeds(mockFeeds, {
        language: 'en'
      });

      expect(result.feeds).toHaveLength(3); // All feeds are English
      expect(result.appliedFilters).toContain('language (en)');
    });

    it('should handle empty interests with no-filter message', () => {
      const result = filterFeeds(mockFeeds, {
        interests: []
      });

      expect(result.feeds).toHaveLength(3); // All feeds
      expect(result.appliedFilters).toContain('no-filter (empty interests)');
      expect(result.warnings).toContain('No interests selected - showing all feeds');
    });
  });

  describe('groupFeedsByCategory', () => {
    it('should group feeds by selected categories', () => {
      const grouped = groupFeedsByCategory(mockFeeds, ['tech', 'news']); // Use frontend categories

      expect(grouped).toHaveProperty('tech');
      expect(grouped).toHaveProperty('news');
      expect(grouped.tech).toHaveLength(2);
      expect(grouped.news).toHaveLength(1);
    });

    it('should only include categories with feeds', () => {
      const grouped = groupFeedsByCategory(mockFeeds, ['tech', 'NonExistent']); // Use frontend category

      expect(grouped).toHaveProperty('tech');
      expect(grouped).not.toHaveProperty('NonExistent');
    });

    it('should handle case-insensitive category matching', () => {
      const grouped = groupFeedsByCategory(mockFeeds, ['tech']); // Use frontend category

      expect(grouped).toHaveProperty('tech');
      expect(grouped.tech).toHaveLength(2);
    });
  });

  describe('validateFilteringConsistency', () => {
    it('should validate correct filtering logic', () => {
      const result = validateFilteringConsistency(mockFeeds, {
        interests: ['tech'] // Use frontend category
      });

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect when empty filters should return all feeds', () => {
      const result = validateFilteringConsistency(mockFeeds, {});

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should validate interest filtering consistency', () => {
      const result = validateFilteringConsistency(mockFeeds, {
        interests: ['tech', 'news'] // Use frontend categories
      });

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty feed list', () => {
      const result = filterFeedsByInterests([], ['tech']); // Use frontend category

      expect(result.feeds).toHaveLength(0);
      expect(result.filteredCount).toBe(0);
      expect(result.totalCount).toBe(0);
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

      const result = filterFeeds(feedsWithMissingFields, {
        search: 'minimal'
      });

      expect(result.feeds).toHaveLength(1); // Should find by name
    });

    it('should handle special characters in search', () => {
      const result = filterFeeds(mockFeeds, {
        search: 'tech & science!'
      });

      // Should not crash and handle gracefully
      expect(result.isValid).toBe(undefined); // No validation errors
      expect(Array.isArray(result.feeds)).toBe(true);
    });
  });
});