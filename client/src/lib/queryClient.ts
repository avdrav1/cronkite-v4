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
  
  // Add Supabase JWT token for serverless auth (production)
  let token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If we get a 401, try refreshing the token and retry once
  // This handles cases where the token expired or wasn't available on first try
  if (res.status === 401 && isSupabaseConfigured()) {
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
  
  // Add Supabase JWT token for serverless auth (production)
  const token = await getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    
    // Add Supabase JWT token for serverless auth (production)
    let token = await getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    let res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers,
    });

    // If we get a 401 and behavior is "throw", try refreshing token and retry once
    if (res.status === 401 && unauthorizedBehavior === "throw" && isSupabaseConfigured()) {
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
