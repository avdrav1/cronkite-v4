/**
 * Frontend Feed Integration Tests
 * 
 * Tests the FeedPreview component integration with the feed system
 * Validates error handling, loading states, and user feedback
 * Tests the complete frontend flow for feed display and selection
 * 
 * Requirements: 1.3, 3.1, 3.2, 3.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { FeedPreview } from '../client/src/components/onboarding/FeedPreview';
import { filterFeedsByInterests, groupFeedsByCategory } from '../client/src/lib/feed-filtering';
import type { RecommendedFeed } from '@shared/schema';

// Mock the API request function
vi.mock('../client/src/lib/queryClient', () => ({
  apiRequest: vi.fn()
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}));

describe('Frontend Feed Integration Tests', () => {
  const mockFeeds: RecommendedFeed[] = [
    {
      id: 'feed-1',
      name: 'TechCrunch',
      url: 'https://techcrunch.com/feed/',
      site_url: 'https://techcrunch.com',
      description: 'The latest technology news and information on startups',
      icon_url: 'https://techcrunch.com/favicon.ico',
      category: 'Technology',
      country: 'US',
      language: 'en',
      tags: ['technology', 'startups', 'venture capital'],
      popularity_score: 95,
      article_frequency: 'hourly',
      is_featured: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'feed-2',
      name: 'BBC News',
      url: 'http://feeds.bbci.co.uk/news/rss.xml',
      site_url: 'https://www.bbc.com/news',
      description: 'Breaking news, sport, TV, radio and a whole lot more',
      icon_url: 'https://www.bbc.com/favicon.ico',
      category: 'News',
      country: 'UK',
      language: 'en',
      tags: ['news', 'world', 'politics'],
      popularity_score: 98,
      article_frequency: 'hourly',
      is_featured: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'feed-3',
      name: 'Wall Street Journal',
      url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
      site_url: 'https://www.wsj.com',
      description: 'Breaking news and analysis from the U.S. and around the world',
      icon_url: 'https://www.wsj.com/favicon.ico',
      category: 'Business',
      country: 'US',
      language: 'en',
      tags: ['business', 'finance', 'markets'],
      popularity_score: 92,
      article_frequency: 'hourly',
      is_featured: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  const defaultProps = {
    selectedInterests: ['tech', 'news'],
    selectedFeeds: [],
    toggleFeed: vi.fn(),
    toggleCategory: vi.fn(),
    onNext: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feed Count Display Consistency (Requirement 1.3)', () => {
    it('should display correct feed count in header', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      render(<FeedPreview {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Here's what we found for you/)).toBeInTheDocument();
      });

      // Should display the filtered count based on interests
      const filteredFeeds = filterFeedsByInterests(mockFeeds, defaultProps.selectedInterests);
      expect(screen.getByText(`${filteredFeeds.filteredCount} feeds based on your interests`)).toBeInTheDocument();
    });

    it('should update count when interests change', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      const { rerender } = render(<FeedPreview {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Here's what we found for you/)).toBeInTheDocument();
      });

      // Change interests
      const newProps = { ...defaultProps, selectedInterests: ['tech'] };
      rerender(<FeedPreview {...newProps} />);

      const filteredFeeds = filterFeedsByInterests(mockFeeds, newProps.selectedInterests);
      expect(screen.getByText(`${filteredFeeds.filteredCount} feeds based on your interests`)).toBeInTheDocument();
    });

    it('should show all feeds when no interests selected', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      const propsWithNoInterests = { ...defaultProps, selectedInterests: [] };
      render(<FeedPreview {...propsWithNoInterests} />);

      await waitFor(() => {
        expect(screen.getByText(/Here's what we found for you/)).toBeInTheDocument();
      });

      // Should show all feeds when no interests selected
      expect(screen.getByText(`${mockFeeds.length} feeds based on your interests`)).toBeInTheDocument();
    });
  });

  describe('Loading States and User Feedback (Requirement 3.1)', () => {
    it('should show loading spinner while fetching feeds', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<FeedPreview {...defaultProps} />);

      expect(screen.getByText('Loading feeds...')).toBeInTheDocument();
      expect(screen.getByText('Finding the best sources for your interests')).toBeInTheDocument();
    });

    it('should show retry state when retrying failed requests', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockImplementation(() => new Promise(() => {})); // Never resolves on retry

      render(<FeedPreview {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Retrying/)).toBeInTheDocument();
      });
    });

    it('should provide clear feedback during subscription process', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      const propsWithSelectedFeeds = { 
        ...defaultProps, 
        selectedFeeds: ['feed-1', 'feed-2'] 
      };

      render(<FeedPreview {...propsWithSelectedFeeds} />);

      await waitFor(() => {
        expect(screen.getByText('Continue')).toBeInTheDocument();
      });

      // Mock subscription API call
      (apiRequest as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('Subscribing...')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery (Requirement 3.2)', () => {
    it('should display error message when feed loading fails', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockRejectedValue(new Error('Network error'));

      render(<FeedPreview {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load feeds')).toBeInTheDocument();
        expect(screen.getByText(/We're having trouble connecting to our servers/)).toBeInTheDocument();
      });
    });

    it('should provide retry functionality for failed requests', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ feeds: mockFeeds })
        });

      render(<FeedPreview {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Try Again'));

      await waitFor(() => {
        expect(screen.getByText(/Here's what we found for you/)).toBeInTheDocument();
      });
    });

    it('should handle different error types appropriately', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      
      // Test network error
      (apiRequest as any).mockRejectedValue(new TypeError('fetch error'));

      const { rerender } = render(<FeedPreview {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });

      // Test timeout error
      const timeoutError = new Error('timeout');
      timeoutError.name = 'AbortError';
      (apiRequest as any).mockRejectedValue(timeoutError);

      rerender(<FeedPreview {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Request timed out/)).toBeInTheDocument();
      });
    });

    it('should show refresh page option for non-retryable errors', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      const serverError = new Error('500: Internal Server Error');
      (apiRequest as any).mockRejectedValue(serverError);

      render(<FeedPreview {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Refresh Page')).toBeInTheDocument();
      });
    });
  });

  describe('Feed Filtering and Display (Requirement 3.3)', () => {
    it('should group feeds by category correctly', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      // Include all categories in selected interests to see all feeds
      const propsWithAllCategories = {
        ...defaultProps,
        selectedInterests: ['tech', 'news', 'business']
      };

      render(<FeedPreview {...propsWithAllCategories} />);

      await waitFor(() => {
        expect(screen.getByText('TechCrunch')).toBeInTheDocument();
        expect(screen.getByText('News')).toBeInTheDocument();
        expect(screen.getByText('Business')).toBeInTheDocument();
      });
    });

    it('should display feed information correctly', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      // Include all categories in selected interests to see all feeds
      const propsWithAllCategories = {
        ...defaultProps,
        selectedInterests: ['tech', 'news', 'business']
      };

      render(<FeedPreview {...propsWithAllCategories} />);

      await waitFor(() => {
        expect(screen.getByText('TechCrunch')).toBeInTheDocument();
        expect(screen.getByText('BBC News')).toBeInTheDocument();
        expect(screen.getByText('Wall Street Journal')).toBeInTheDocument();
      });

      // Check descriptions
      expect(screen.getByText(/The latest technology news and information on startups/)).toBeInTheDocument();
      expect(screen.getByText(/Breaking news, sport, TV, radio and a whole lot more/)).toBeInTheDocument();
    });

    it('should handle feed selection correctly', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      const toggleFeedMock = vi.fn();
      const propsWithMock = { ...defaultProps, toggleFeed: toggleFeedMock };

      render(<FeedPreview {...propsWithMock} />);

      await waitFor(() => {
        expect(screen.getByText('TechCrunch')).toBeInTheDocument();
        expect(screen.getByText('BBC News')).toBeInTheDocument();
        expect(screen.getByText('Wall Street Journal')).toBeInTheDocument();
      });

      // Click on a feed to select it
      fireEvent.click(screen.getByText('TechCrunch'));

      expect(toggleFeedMock).toHaveBeenCalledWith('feed-1');
    });

    it('should show selected feed count and estimated articles', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      const propsWithSelectedFeeds = { 
        ...defaultProps, 
        selectedFeeds: ['feed-1', 'feed-2'] 
      };

      render(<FeedPreview {...propsWithSelectedFeeds} />);

      await waitFor(() => {
        expect(screen.getByText(/2 feeds selected/)).toBeInTheDocument();
        expect(screen.getByText(/articles\/day/)).toBeInTheDocument();
      });
    });
  });

  describe('Category Management', () => {
    it('should allow selecting all feeds in a category', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      const toggleCategoryMock = vi.fn();
      const propsWithMock = { ...defaultProps, toggleCategory: toggleCategoryMock };

      render(<FeedPreview {...propsWithMock} />);

      await waitFor(() => {
        expect(screen.getByText('Tech')).toBeInTheDocument();
      });

      // Find and click "Select All" button for Technology category
      const selectAllButtons = screen.getAllByText('Select All');
      fireEvent.click(selectAllButtons[0]);

      expect(toggleCategoryMock).toHaveBeenCalled();
    });

    it('should show deselect all when all feeds in category are selected', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      const propsWithAllTechSelected = { 
        ...defaultProps, 
        selectedFeeds: ['feed-1'] // TechCrunch is the only tech feed in our mock
      };

      render(<FeedPreview {...propsWithAllTechSelected} />);

      await waitFor(() => {
        expect(screen.getByText('Deselect All')).toBeInTheDocument();
      });
    });
  });

  describe('Integration with Feed Filtering Library', () => {
    it('should use feed filtering library correctly', () => {
      const interests = ['Technology', 'News'];
      const result = filterFeedsByInterests(mockFeeds, interests);

      expect(result.feeds.length).toBeGreaterThan(0);
      expect(result.filteredCount).toBe(result.feeds.length);
      expect(result.warnings).toBeDefined();
    });

    it('should group feeds by category using library function', () => {
      const interests = ['Technology', 'News'];
      const filteredResult = filterFeedsByInterests(mockFeeds, interests);
      const grouped = groupFeedsByCategory(filteredResult.feeds, interests);

      expect(Object.keys(grouped).length).toBeGreaterThan(0);
      expect(grouped['tech']).toBeDefined();
      expect(grouped['news']).toBeDefined();
    });

    it('should handle empty interests correctly', () => {
      const result = filterFeedsByInterests(mockFeeds, []);

      expect(result.feeds.length).toBe(mockFeeds.length);
      expect(result.filteredCount).toBe(mockFeeds.length);
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should have accessible form controls', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      render(<FeedPreview {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Continue')).toBeInTheDocument();
      });

      const continueButton = screen.getByText('Continue');
      expect(continueButton).toBeDisabled(); // Should be disabled when no feeds selected
    });

    it('should enable continue button when feeds are selected', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      const propsWithSelectedFeeds = { 
        ...defaultProps, 
        selectedFeeds: ['feed-1'] 
      };

      render(<FeedPreview {...propsWithSelectedFeeds} />);

      await waitFor(() => {
        expect(screen.getByText('Continue')).toBeInTheDocument();
      });

      const continueButton = screen.getByText('Continue');
      expect(continueButton).not.toBeDisabled();
    });

    it('should show loading state during subscription', async () => {
      const { apiRequest } = await import('../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValue({
        json: () => Promise.resolve({ feeds: mockFeeds })
      });

      const propsWithSelectedFeeds = { 
        ...defaultProps, 
        selectedFeeds: ['feed-1'] 
      };

      render(<FeedPreview {...propsWithSelectedFeeds} />);

      await waitFor(() => {
        expect(screen.getByText('Continue')).toBeInTheDocument();
      });

      // Mock subscription to never resolve
      (apiRequest as any).mockImplementation(() => new Promise(() => {}));

      fireEvent.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('Subscribing...')).toBeInTheDocument();
      });
    });
  });
});