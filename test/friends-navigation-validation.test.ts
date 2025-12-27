/**
 * Friends Navigation Validation Tests
 * 
 * Validates that the friends navigation integration is properly implemented
 * Tests the core navigation functionality and component integration
 * 
 * Requirements: All requirements from friends-navigation-access spec
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Friends Navigation Integration Validation', () => {
  describe('Settings Page Integration', () => {
    it('should include Friends tab in SETTINGS_TABS array', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      // Check that Friends tab is defined in SETTINGS_TABS
      expect(settingsContent).toContain("{ id: 'friends', label: 'Friends', icon: Users }");
      
      // Check that Friends tab is positioned correctly (after account, before privacy)
      const tabsMatch = settingsContent.match(/const SETTINGS_TABS = \[([\s\S]*?)\];/);
      expect(tabsMatch).toBeTruthy();
      
      if (tabsMatch) {
        const tabsContent = tabsMatch[1];
        const accountIndex = tabsContent.indexOf("id: 'account'");
        const friendsIndex = tabsContent.indexOf("id: 'friends'");
        const privacyIndex = tabsContent.indexOf("id: 'privacy'");
        
        expect(accountIndex).toBeGreaterThan(-1);
        expect(friendsIndex).toBeGreaterThan(-1);
        expect(privacyIndex).toBeGreaterThan(-1);
        expect(friendsIndex).toBeGreaterThan(accountIndex);
        expect(friendsIndex).toBeLessThan(privacyIndex);
      }
    });

    it('should import FriendManagement component', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      // Check that FriendManagement is imported
      expect(settingsContent).toContain('import { FriendManagement } from "@/components/friends/FriendManagement"');
    });

    it('should render FriendManagement component in renderContent function', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      // Check that friends case is handled in renderContent
      expect(settingsContent).toContain("case 'friends':");
      expect(settingsContent).toContain('return <FriendManagement />');
    });

    it('should support URL-based tab activation', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      // Check that URL parameter parsing is implemented
      expect(settingsContent).toContain('useSearch');
      expect(settingsContent).toContain('URLSearchParams');
      expect(settingsContent).toContain("params.get('tab')");
      
      // Check that activeTab state is managed based on URL
      expect(settingsContent).toContain('useState');
      expect(settingsContent).toContain('useEffect');
    });
  });

  describe('AppShell Desktop Navigation Integration', () => {
    it('should include Friends icon in desktop navigation', () => {
      const appShellPath = resolve(__dirname, '../client/src/components/layout/AppShell.tsx');
      const appShellContent = readFileSync(appShellPath, 'utf-8');
      
      // Check that Users icon is imported (for Friends)
      expect(appShellContent).toContain('Users');
      
      // Check that Friends link exists in desktop navigation
      expect(appShellContent).toContain('/settings?tab=friends');
      
      // Check that Friends icon button is present
      const friendsLinkPattern = /<Link href="\/settings\?tab=friends"[\s\S]*?<Users/;
      expect(appShellContent).toMatch(friendsLinkPattern);
    });

    it('should have Friends icon with proper styling and tooltip', () => {
      const appShellPath = resolve(__dirname, '../client/src/components/layout/AppShell.tsx');
      const appShellContent = readFileSync(appShellPath, 'utf-8');
      
      // Check for Friends tooltip
      expect(appShellContent).toContain('title="Friends"');
      
      // Check for consistent styling classes
      const friendsButtonPattern = /title="Friends"[\s\S]*?className="[^"]*text-muted-foreground[^"]*hover:text-foreground[^"]*"/;
      expect(appShellContent).toMatch(friendsButtonPattern);
    });
  });

  describe('AppShell Mobile Navigation Integration', () => {
    it('should include Friends menu item in mobile navigation', () => {
      const appShellPath = resolve(__dirname, '../client/src/components/layout/AppShell.tsx');
      const appShellContent = readFileSync(appShellPath, 'utf-8');
      
      // Check that Friends menu item exists in mobile navigation
      const mobileNavPattern = /<Link href="\/settings\?tab=friends"[\s\S]*?onClick=\{[^}]*setIsMobileNavOpen\(false\)[^}]*\}[\s\S]*?<Users[\s\S]*?Friends/;
      expect(appShellContent).toMatch(mobileNavPattern);
    });

    it('should close mobile navigation when Friends menu item is clicked', () => {
      const appShellPath = resolve(__dirname, '../client/src/components/layout/AppShell.tsx');
      const appShellContent = readFileSync(appShellPath, 'utf-8');
      
      // Check that mobile sheet closes when Friends link is clicked
      const mobileClosePattern = /href="\/settings\?tab=friends"[\s\S]*?onClick=\{[^}]*setIsMobileNavOpen\(false\)/;
      expect(appShellContent).toMatch(mobileClosePattern);
    });

    it('should have consistent styling with other mobile navigation items', () => {
      const appShellPath = resolve(__dirname, '../client/src/components/layout/AppShell.tsx');
      const appShellContent = readFileSync(appShellPath, 'utf-8');
      
      // Check for consistent button styling in mobile navigation
      const mobileButtonPattern = /<Button variant="ghost" className="w-full justify-start gap-2"[\s\S]*?<Users[\s\S]*?Friends/;
      expect(appShellContent).toMatch(mobileButtonPattern);
    });
  });

  describe('Component Dependencies', () => {
    it('should have FriendManagement component available', () => {
      const friendManagementPath = resolve(__dirname, '../client/src/components/friends/FriendManagement.tsx');
      
      // Check that FriendManagement component file exists
      expect(() => readFileSync(friendManagementPath, 'utf-8')).not.toThrow();
      
      const friendManagementContent = readFileSync(friendManagementPath, 'utf-8');
      
      // Check that component is properly exported
      expect(friendManagementContent).toContain('export function FriendManagement');
      
      // Check that component has the expected structure
      expect(friendManagementContent).toContain('Friends');
      expect(friendManagementContent).toContain('Connect with friends');
      expect(friendManagementContent).toContain('Tabs');
      expect(friendManagementContent).toContain('FriendsList');
      expect(friendManagementContent).toContain('UserSearch');
      expect(friendManagementContent).toContain('UserDiscovery');
    });

    it('should have all required icon imports', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      // Check that Users icon is imported for Friends tab
      expect(settingsContent).toContain('Users');
      
      const appShellPath = resolve(__dirname, '../client/src/components/layout/AppShell.tsx');
      const appShellContent = readFileSync(appShellPath, 'utf-8');
      
      // Check that Users icon is imported for Friends navigation
      expect(appShellContent).toContain('Users');
    });
  });

  describe('URL State Management', () => {
    it('should handle URL parameter parsing correctly', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      // Check for proper URL parameter handling
      expect(settingsContent).toContain('URLSearchParams');
      expect(settingsContent).toContain('searchString');
      expect(settingsContent).toContain('urlTabParam');
      
      // Check for validation of tab parameters
      expect(settingsContent).toContain('validTabs');
      expect(settingsContent).toContain('includes(urlTabParam)');
    });

    it('should update URL when tab changes', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      // Check for URL update functionality
      expect(settingsContent).toContain('handleTabChange');
      expect(settingsContent).toContain('setLocation');
      expect(settingsContent).toContain('params.set');
    });

    it('should default to feeds tab for invalid parameters', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      // Check for default fallback behavior
      expect(settingsContent).toContain("'feeds'");
      
      // Check for validation logic
      const validationPattern = /validTabs\.includes\(urlTabParam\)[\s\S]*?urlTabParam[\s\S]*?'feeds'/;
      expect(settingsContent).toMatch(validationPattern);
    });
  });

  describe('Navigation Consistency', () => {
    it('should use consistent href patterns across all navigation points', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      const appShellPath = resolve(__dirname, '../client/src/components/layout/AppShell.tsx');
      const appShellContent = readFileSync(appShellPath, 'utf-8');
      
      // Check that all navigation points use the same URL pattern
      const urlPattern = '/settings?tab=friends';
      
      // Should appear in AppShell (both desktop and mobile)
      const appShellMatches = (appShellContent.match(/\/settings\?tab=friends/g) || []).length;
      expect(appShellMatches).toBeGreaterThanOrEqual(2); // Desktop and mobile
      
      // Should be handled in Settings page URL parsing (check for tab parameter handling)
      expect(settingsContent).toContain("params.set('tab'");
    });

    it('should maintain consistent component structure', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      // Check that Friends tab follows the same pattern as other tabs
      const tabPattern = /\{ id: 'friends', label: 'Friends', icon: Users \}/;
      expect(settingsContent).toMatch(tabPattern);
      
      // Check that Friends case follows the same pattern as other cases
      const casePattern = /case 'friends':\s*return <FriendManagement \/>;/;
      expect(settingsContent).toMatch(casePattern);
    });
  });

  describe('Integration Completeness', () => {
    it('should have all required navigation access points implemented', () => {
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      const appShellPath = resolve(__dirname, '../client/src/components/layout/AppShell.tsx');
      const appShellContent = readFileSync(appShellPath, 'utf-8');
      
      // 1. Settings page Friends tab
      expect(settingsContent).toContain("id: 'friends'");
      expect(settingsContent).toContain('<FriendManagement />');
      
      // 2. Desktop navigation Friends icon
      expect(appShellContent).toContain('title="Friends"');
      expect(appShellContent).toContain('/settings?tab=friends');
      
      // 3. Mobile navigation Friends menu item
      const mobileNavCount = (appShellContent.match(/\/settings\?tab=friends/g) || []).length;
      expect(mobileNavCount).toBeGreaterThanOrEqual(2); // Desktop + Mobile
      
      // 4. URL state management
      expect(settingsContent).toContain('URLSearchParams');
      expect(settingsContent).toContain('useSearch');
    });

    it('should validate that all components are properly wired together', () => {
      // Check Settings page imports
      const settingsPath = resolve(__dirname, '../client/src/pages/Settings.tsx');
      const settingsContent = readFileSync(settingsPath, 'utf-8');
      
      expect(settingsContent).toContain('import { FriendManagement }');
      expect(settingsContent).toContain('from "@/components/friends/FriendManagement"');
      
      // Check that wouter routing is used
      expect(settingsContent).toContain('useLocation');
      expect(settingsContent).toContain('useSearch');
      
      // Check AppShell imports
      const appShellPath = resolve(__dirname, '../client/src/components/layout/AppShell.tsx');
      const appShellContent = readFileSync(appShellPath, 'utf-8');
      
      expect(appShellContent).toContain('Link, useLocation, useSearch');
      expect(appShellContent).toContain('from "wouter"');
    });
  });
});