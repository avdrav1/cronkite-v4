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
  // In development: use session cookies only
  // In production: use Supabase JWT tokens with session cookie fallback
  const isDevelopment = (
    (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
    (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1')
  );

  // Always try to get Supabase token first, but only use it in production or if explicitly configured
  let token = null;
  if (isSupabaseConfigured()) {
    token = await getAccessToken();
  }

  // Use token in production, or in development if it's the only auth method available
  if (token && !isDevelopment) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Always include cookies for session auth
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
      });
      if (res.ok) {
        console.log('✅ apiRequest: Retry successful after token refresh');
      }
    }
  }

  await throwIfResNotOk(res);
  return res;
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
  
  // Use token in production, or in development if it's the only auth method available
  if (token && !isDevelopment) {
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
    
    // Use token in production, or in development if it's the only auth method available
    if (token && !isDevelopment) {
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
