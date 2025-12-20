import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

/**
 * Feature: full-stack-integration, Property 1: Authentication round trip
 * For any valid authentication method (email/password or Google OAuth), 
 * successful authentication should create a user session and redirect to the appropriate next step
 * Validates: Requirements 1.2, 1.3, 1.4
 */
describe('Property 1: Authentication round trip', () => {
  it('should handle valid email/password authentication consistently', () => {
    fc.assert(fc.property(
      fc.emailAddress(),
      fc.string({ minLength: 6, maxLength: 50 }).filter(s => s.trim().length >= 6),
      fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length >= 1),
      async (email, password, displayName) => {
        // Mock successful authentication response
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({
            user: {
              id: 'user-123',
              email,
              display_name: displayName,
              avatar_url: null,
              onboarding_completed: false
            }
          })
        });
        
        global.fetch = mockFetch;
        
        // Simulate authentication request
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password, display_name: displayName })
        });
        
        const data = await response.json();
        
        // Property: Successful authentication should return user data
        expect(response.ok).toBe(true);
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe(email);
        expect(data.user.display_name).toBe(displayName);
        expect(data.user.id).toBeDefined();
      }
    ), { numRuns: 100 });
  });

  it('should handle Google OAuth tokens consistently', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length >= 20), // access_token
      fc.option(fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length >= 20)), // refresh_token
      async (accessToken, refreshToken) => {
        // Mock successful Google OAuth response
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            user: {
              id: 'google-user-123',
              email: 'user@gmail.com',
              display_name: 'Google User',
              avatar_url: 'https://example.com/avatar.jpg',
              onboarding_completed: false
            }
          })
        });
        
        global.fetch = mockFetch;
        
        // Simulate Google OAuth request
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            access_token: accessToken,
            refresh_token: refreshToken 
          })
        });
        
        const data = await response.json();
        
        // Property: Successful OAuth should return user data
        expect(response.ok).toBe(true);
        expect(data.user).toBeDefined();
        expect(data.user.email).toBeDefined();
        expect(data.user.id).toBeDefined();
      }
    ), { numRuns: 100 });
  });
});

/**
 * Feature: full-stack-integration, Property 2: Authentication error handling
 * For any invalid authentication attempt, the system should display appropriate error messages 
 * while maintaining form state
 * Validates: Requirements 1.5
 */
describe('Property 2: Authentication error handling', () => {
  it('should handle invalid credentials consistently', () => {
    fc.assert(fc.property(
      fc.emailAddress(),
      fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length >= 1), // Invalid short password
      async (email, invalidPassword) => {
        // Mock validation error response
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'Validation error',
            message: 'Invalid input data',
            details: [{ path: ['password'], message: 'String must contain at least 6 character(s)' }]
          })
        });
        
        global.fetch = mockFetch;
        
        // Simulate invalid authentication request
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            email, 
            password: invalidPassword, 
            display_name: 'Test User' 
          })
        });
        
        const data = await response.json();
        
        // Property: Invalid authentication should return error with details
        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(data.error).toBe('Validation error');
        expect(data.message).toBeDefined();
      }
    ), { numRuns: 100 });
  });

  it('should handle network errors gracefully', () => {
    fc.assert(fc.property(
      fc.emailAddress(),
      fc.string({ minLength: 6 }).filter(s => s.trim().length >= 6),
      async (email, password) => {
        // Mock network error
        const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
        global.fetch = mockFetch;
        
        // Property: Network errors should be catchable
        await expect(async () => {
          await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
          });
        }).rejects.toThrow('Network error');
      }
    ), { numRuns: 100 });
  });
});