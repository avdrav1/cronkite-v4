import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { isSupabaseConfigured, getAccessToken, refreshAccessToken } from '@shared/supabase';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Detect environment more reliably
  const isDevelopment = (
    (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
    (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1')
  );

  // Always try to get Supabase token first
  let token = null;
  if (isSupabaseConfigured()) {
    token = await getAccessToken();
  }

  // Always use JWT token when available, but skip during OAuth callback to avoid conflicts
  const isOAuthCallback = window.location.pathname === '/auth/callback';
  if (token && !isOAuthCallback) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    let res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: controller.signal,
    });

    // If we get a 401, try refreshing the token and retry once
    if (res.status === 401 && token && isSupabaseConfigured()) {
      console.log('🔄 apiRequest: Got 401, attempting token refresh and retry...');
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
          signal: controller.signal,
        });
        if (res.ok) {
          console.log('✅ apiRequest: Retry successful after token refresh');
        }
      }
    }

    clearTimeout(timeoutId);
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout: ${url}`);
    }
    throw error;
  }
}

/**
 * Make an authenticated fetch request without throwing on errors
 * Useful for auth checks where 401 is expected
 */
export async function apiFetch(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Detect environment more reliably
  const isDevelopment = (
    (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
    (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1')
  );
  
  // Always try to get Supabase token if configured
  let token = null;
  if (isSupabaseConfigured()) {
    token = await getAccessToken();
  }
  
  // Always use JWT token when available, but skip during OAuth callback
  const isOAuthCallback = window.location.pathname === '/auth/callback';
  if (token && !isOAuthCallback) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Always include cookies for session auth
  });
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    
    // Detect environment more reliably
    const isDevelopment = (
      (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
      (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
      (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1')
    );
    
    // Always try to get Supabase token if configured
    let token = null;
    if (isSupabaseConfigured()) {
      token = await getAccessToken();
    }
    
    // Always use JWT token when available, but skip during OAuth callback
    const isOAuthCallback = window.location.pathname === '/auth/callback';
    if (token && !isOAuthCallback) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    let res = await fetch(queryKey.join("/") as string, {
      credentials: "include", // Always include cookies for session auth
      headers,
    });

    // If we get a 401 and behavior is "throw", try refreshing token and retry once
    if (res.status === 401 && unauthorizedBehavior === "throw" && token && isSupabaseConfigured()) {
      console.log('🔄 getQueryFn: Got 401, attempting token refresh and retry...');
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        res = await fetch(queryKey.join("/") as string, {
          credentials: "include",
          headers,
        });
        if (res.ok) {
          console.log('✅ getQueryFn: Retry successful after token refresh');
        }
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000, // 2 minutes instead of Infinity
      retry: (failureCount, error) => {
        // Don't retry auth errors
        if (error instanceof Error && error.message.includes('401')) {
          return false;
        }
        // Retry network errors up to 2 times
        return failureCount < 2;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
    },
  },
});
