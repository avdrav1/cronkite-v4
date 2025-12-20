import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { type Profile } from '@shared/schema';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component to access auth context
function TestComponent() {
  const auth = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{auth.isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">{auth.isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user">{auth.user ? auth.user.email : 'no-user'}</div>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should provide auth context', () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Not authenticated' })
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('loading');
  });

  it('should handle authentication check failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Not authenticated' })
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('not-authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });

  it('should handle successful authentication check', async () => {
    const mockUser: Profile = {
      id: 'user-1',
      email: 'test@example.com',
      display_name: 'Test User',
      avatar_url: null,
      timezone: 'America/New_York',
      region_code: null,
      onboarding_completed: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: mockUser })
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');
    
    consoleSpy.mockRestore();
  });
});

describe('AuthContext Methods', () => {
  let authContext: any;

  function TestComponentWithMethods() {
    authContext = useAuth();
    return <div>Test</div>;
  }

  beforeEach(() => {
    mockFetch.mockClear();
    // Mock initial auth check
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Not authenticated' })
    });
  });

  it('should handle login success', async () => {
    const mockUser: Profile = {
      id: 'user-1',
      email: 'test@example.com',
      display_name: 'Test User',
      avatar_url: null,
      timezone: 'America/New_York',
      region_code: null,
      onboarding_completed: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    render(
      <AuthProvider>
        <TestComponentWithMethods />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authContext.isLoading).toBe(false);
    });

    // Mock login response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: mockUser })
    });

    await authContext.login('test@example.com', 'password123');

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });
  });

  it('should handle login failure', async () => {
    render(
      <AuthProvider>
        <TestComponentWithMethods />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authContext.isLoading).toBe(false);
    });

    // Mock login failure
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' })
    });

    await expect(authContext.login('test@example.com', 'wrongpassword')).rejects.toThrow('Invalid credentials');
  });

  it('should handle register success', async () => {
    const mockUser: Profile = {
      id: 'user-1',
      email: 'test@example.com',
      display_name: 'Test User',
      avatar_url: null,
      timezone: 'America/New_York',
      region_code: null,
      onboarding_completed: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    render(
      <AuthProvider>
        <TestComponentWithMethods />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authContext.isLoading).toBe(false);
    });

    // Mock register response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ user: mockUser })
    });

    await authContext.register('test@example.com', 'password123', 'Test User');

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ 
        email: 'test@example.com', 
        password: 'password123', 
        display_name: 'Test User' 
      }),
    });
  });

  it('should handle logout', async () => {
    render(
      <AuthProvider>
        <TestComponentWithMethods />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(authContext.isLoading).toBe(false);
    });

    // Mock logout response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Logged out successfully' })
    });

    await authContext.logout();

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  });
});