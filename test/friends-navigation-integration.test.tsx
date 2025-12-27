/**
 * Friends Navigation Integration Tests
 * 
 * Tests complete navigation flows from all access points to friends functionality
 * Validates FriendManagement component integration in Settings page
 * Tests URL state persistence and mobile/desktop navigation consistency
 * 
 * Requirements: All requirements from friends-navigation-access spec
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Mock all external dependencies first
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      display_name: 'Test User',
      email: 'test@example.com',
      avatar_url: null,
      is_admin: false
    },
    logout: vi.fn()
  })
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ feeds: [] })
  })
}));

vi.mock('@/contexts/WebSocketContext', () => ({
  useWebSocket: () => ({
    isConnected: true,
    lastMessage: null,
    sendMessage: vi.fn()
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('@/hooks/useFeedsQuery', () => ({
  useFeedCountQuery: () => ({
    data: { remaining: 10, total: 50 }
  })
}));

// Mock framer-motion to avoid animation issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  }
}));

// Mock wouter router
vi.mock('wouter', () => ({
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
  useLocation: () => ['/settings', vi.fn()],
  useSearch: () => '?tab=friends'
}));

// Mock all the settings components
vi.mock('@/components/settings/AppearanceSettings', () => ({
  AppearanceSettings: () => <div data-testid="appearance-settings">Appearance Settings</div>
}));

vi.mock('@/components/settings/FeedManagement', () => ({
  FeedManagement: () => <div data-testid="feed-management">Feed Management</div>
}));

vi.mock('@/components/settings/AIUsageSettings', () => ({
  AIUsageSettings: () => <div data-testid="ai-usage-settings">AI Usage Settings</div>
}));

vi.mock('@/components/settings/ScheduleSettings', () => ({
  ScheduleSettings: () => <div data-testid="schedule-settings">Schedule Settings</div>
}));

vi.mock('@/components/settings/DataExportSettings', () => ({
  DataExportSettings: () => <div data-testid="data-export-settings">Data Export Settings</div>
}));

vi.mock('@/components/settings/ReportingSettings', () => ({
  ReportingSettings: () => <div data-testid="reporting-settings">Reporting Settings</div>
}));

// Mock the FriendManagement component
vi.mock('@/components/friends/FriendManagement', () => ({
  FriendManagement: () => (
    <div data-testid="friend-management">
      <h2>Friends</h2>
      <p>Connect with friends and manage your social network</p>
      <div role="tablist">
        <button role="tab">Friends</button>
        <button role="tab">Requests</button>
        <button role="tab">Find Friends</button>
        <button role="tab">Discover</button>
      </div>
      <div role="tabpanel">Friends content</div>
    </div>
  )
}));

// Mock layout components
vi.mock('@/components/layout/FeedsList', () => ({
  FeedsList: () => <div data-testid="feeds-list">Feeds List</div>
}));

vi.mock('@/components/trending/TrendingClusters', () => ({
  TrendingClusters: () => <div data-testid="trending-clusters">Trending Clusters</div>
}));

vi.mock('@/components/search/SemanticSearch', () => ({
  SemanticSearch: () => <div data-testid="semantic-search">Semantic Search</div>
}));

vi.mock('@/components/ui/websocket-status', () => ({
  WebSocketStatusIcon: () => <div data-testid="websocket-status">WebSocket Status</div>
}));

describe('Friends Navigation Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Settings Page Friends Integration', () => {
    it('should display Friends tab in settings navigation', async () => {
      // Import components after mocks are set up
      const { default: SettingsPage } = await import('@/pages/Settings');
      
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Check that Friends tab is present in navigation
      expect(screen.getByRole('button', { name: /Friends/ })).toBeInTheDocument();
    });

    it('should render FriendManagement component when Friends tab is clicked', async () => {
      const { default: SettingsPage } = await import('@/pages/Settings');
      
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Click Friends tab
      const friendsTab = screen.getByRole('button', { name: /Friends/ });
      fireEvent.click(friendsTab);

      await waitFor(() => {
        // Check that FriendManagement component is rendered
        expect(screen.getByTestId('friend-management')).toBeInTheDocument();
        expect(screen.getByText('Connect with friends and manage your social network')).toBeInTheDocument();
        expect(screen.getByText('Find Friends')).toBeInTheDocument();
        expect(screen.getByText('Discover')).toBeInTheDocument();
      });
    });

    it('should highlight Friends tab when active', async () => {
      const { default: SettingsPage } = await import('@/pages/Settings');
      
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Click Friends tab
      const friendsTab = screen.getByRole('button', { name: /Friends/ });
      fireEvent.click(friendsTab);

      await waitFor(() => {
        // Check that Friends tab has active styling
        expect(friendsTab).toHaveClass('bg-primary/10', 'text-primary', 'font-bold');
      });
    });
  });

  describe('URL-based Tab Activation', () => {
    it('should activate Friends tab when URL contains tab=friends parameter', async () => {
      const { default: SettingsPage } = await import('@/pages/Settings');
      
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Since we mocked useSearch to return '?tab=friends', the Friends tab should be active
      const friendsTab = screen.getByRole('button', { name: /Friends/ });
      expect(friendsTab).toHaveClass('bg-primary/10', 'text-primary', 'font-bold');

      // Check that FriendManagement component is rendered
      expect(screen.getByTestId('friend-management')).toBeInTheDocument();
    });
  });

  describe('Desktop Navigation Integration', () => {
    it('should display Friends icon in desktop header', async () => {
      const { AppShell } = await import('@/components/layout/AppShell');
      
      render(
        <AppShell>
          <div>Test Content</div>
        </AppShell>
      );

      await waitFor(() => {
        expect(screen.getByText('Cronkite')).toBeInTheDocument();
      });

      // Check for Friends icon link in desktop navigation
      const friendsLinks = screen.getAllByRole('link').filter(link => 
        link.getAttribute('href') === '/settings?tab=friends'
      );
      expect(friendsLinks.length).toBeGreaterThan(0);
    });
  });

  describe('End-to-End Navigation Flows', () => {
    it('should complete navigation flow from Settings page to FriendManagement component', async () => {
      const { default: SettingsPage } = await import('@/pages/Settings');
      
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Verify Friends tab is present
      const friendsTab = screen.getByRole('button', { name: /Friends/ });
      expect(friendsTab).toBeInTheDocument();

      // Click Friends tab
      fireEvent.click(friendsTab);

      await waitFor(() => {
        // Verify we can access FriendManagement functionality
        expect(screen.getByTestId('friend-management')).toBeInTheDocument();
        expect(screen.getByText('Connect with friends and manage your social network')).toBeInTheDocument();
        
        // Verify Friends tab is active
        expect(friendsTab).toHaveClass('bg-primary/10', 'text-primary', 'font-bold');
        
        // Verify FriendManagement component tabs are present
        expect(screen.getByText('Find Friends')).toBeInTheDocument();
        expect(screen.getByText('Discover')).toBeInTheDocument();
        expect(screen.getByText('Requests')).toBeInTheDocument();
      });
    });

    it('should handle direct URL navigation to friends functionality', async () => {
      const { default: SettingsPage } = await import('@/pages/Settings');
      
      render(<SettingsPage />);

      await waitFor(() => {
        // Verify direct navigation works (mocked useSearch returns ?tab=friends)
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByTestId('friend-management')).toBeInTheDocument();
        
        // Verify Friends tab is automatically activated
        const friendsTab = screen.getByRole('button', { name: /Friends/ });
        expect(friendsTab).toHaveClass('bg-primary/10', 'text-primary', 'font-bold');
        
        // Verify FriendManagement component is rendered with all functionality
        expect(screen.getByText('Connect with friends and manage your social network')).toBeInTheDocument();
        expect(screen.getByText('Find Friends')).toBeInTheDocument();
        expect(screen.getByText('Discover')).toBeInTheDocument();
        expect(screen.getByText('Requests')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation State Consistency', () => {
    it('should preserve navigation state when switching between tabs', async () => {
      const { default: SettingsPage } = await import('@/pages/Settings');
      
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Start with Friends tab (should be active due to mocked URL)
      const friendsTab = screen.getByRole('button', { name: /Friends/ });
      expect(friendsTab).toHaveClass('bg-primary/10', 'text-primary', 'font-bold');
      expect(screen.getByTestId('friend-management')).toBeInTheDocument();

      // Switch to another tab
      const feedsTab = screen.getByRole('button', { name: /Feeds/ });
      fireEvent.click(feedsTab);

      await waitFor(() => {
        expect(feedsTab).toHaveClass('bg-primary/10', 'text-primary', 'font-bold');
        expect(friendsTab).not.toHaveClass('bg-primary/10', 'text-primary', 'font-bold');
        expect(screen.getByTestId('feed-management')).toBeInTheDocument();
      });

      // Switch back to Friends tab
      fireEvent.click(friendsTab);

      await waitFor(() => {
        expect(friendsTab).toHaveClass('bg-primary/10', 'text-primary', 'font-bold');
        expect(feedsTab).not.toHaveClass('bg-primary/10', 'text-primary', 'font-bold');
        
        // Verify FriendManagement component is rendered again
        expect(screen.getByTestId('friend-management')).toBeInTheDocument();
        expect(screen.getByText('Connect with friends and manage your social network')).toBeInTheDocument();
      });
    });
  });

  describe('FriendManagement Component Integration', () => {
    it('should render FriendManagement component correctly within Settings page', async () => {
      const { default: SettingsPage } = await import('@/pages/Settings');
      
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Verify FriendManagement component structure (active due to mocked URL)
      expect(screen.getByText('Friends')).toBeInTheDocument();
      expect(screen.getByText('Connect with friends and manage your social network')).toBeInTheDocument();
      
      // Verify all FriendManagement tabs are present
      expect(screen.getByText('Find Friends')).toBeInTheDocument();
      expect(screen.getByText('Discover')).toBeInTheDocument();
      expect(screen.getByText('Requests')).toBeInTheDocument();
      
      // Verify default tab content is present
      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });

    it('should maintain FriendManagement component functionality within Settings context', async () => {
      const { default: SettingsPage } = await import('@/pages/Settings');
      
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      // Test FriendManagement tab switching
      const searchTab = screen.getByRole('tab', { name: /Find Friends/ });
      expect(searchTab).toBeInTheDocument();

      const discoverTab = screen.getByRole('tab', { name: /Discover/ });
      expect(discoverTab).toBeInTheDocument();

      // Verify tabs are functional (they exist and can be interacted with)
      fireEvent.click(searchTab);
      fireEvent.click(discoverTab);
      
      // Both tabs should still be present after interaction
      expect(searchTab).toBeInTheDocument();
      expect(discoverTab).toBeInTheDocument();
    });
  });

  describe('Integration Validation Summary', () => {
    it('should validate all navigation access points work correctly', async () => {
      // Test Settings page integration
      const { default: SettingsPage } = await import('@/pages/Settings');
      const { AppShell } = await import('@/components/layout/AppShell');
      
      // Test Settings page
      const { unmount: unmountSettings } = render(<SettingsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Friends/ })).toBeInTheDocument();
      });
      
      unmountSettings();

      // Test AppShell integration
      render(
        <AppShell>
          <div>Test Content</div>
        </AppShell>
      );

      await waitFor(() => {
        expect(screen.getByText('Cronkite')).toBeInTheDocument();
        
        // Check for Friends navigation links
        const friendsLinks = screen.getAllByRole('link').filter(link => 
          link.getAttribute('href') === '/settings?tab=friends'
        );
        expect(friendsLinks.length).toBeGreaterThan(0);
      });
    });
  });
});