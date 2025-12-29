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
  
  // TEMPORARY FIX: Skip Supabase token to avoid hanging
  // The session cookies should be sufficient for authentication
  console.log('🔑 apiRequest: Skipping token, using cookies only for now');
  
  console.log('🚀 apiRequest: Making request to', url, 'with method', method);
  
  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error('🚀 apiRequest: Request timed out after 10 seconds');
    controller.abort();
  }, 10000);
  
  try {
    let res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Always include cookies for session auth
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('🚀 apiRequest: Got response status:', res.status);

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
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
  
  // Always try to get Supabase token if configured
  let token = null;
  if (isSupabaseConfigured()) {
    token = await getAccessToken();
  }
  
  // Always use token if available (both development and production)
  if (token) {
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
    
    // Always try to get Supabase token if configured
    let token = null;
    if (isSupabaseConfigured()) {
      token = await getAccessToken();
    }
    
    // Always use token if available (both development and production)
    if (token) {
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
