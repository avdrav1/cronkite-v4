import { createClient } from '@supabase/supabase-js'

// For client-side usage, we need to use Vite's import.meta.env
// For server-side, we use process.env
const getSupabaseUrl = (): string | null => {
  // Check for Vite environment variables (client-side)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    console.log('🔧 Supabase URL from VITE env:', url ? url.substring(0, 40) + '...' : 'not set');
    if (url && url.trim() !== '' && url.startsWith('http')) {
      // Accept both .supabase.co and local URLs
      if (url.includes('.supabase.co') || url.includes('127.0.0.1') || url.includes('localhost')) {
        return url;
      }
    }
  }
  // Check for Node.js environment variables (server-side)
  if (typeof process !== 'undefined' && process.env?.SUPABASE_URL) {
    const url = process.env.SUPABASE_URL;
    if (url && url.trim() !== '' && url.startsWith('http')) {
      if (url.includes('.supabase.co') || url.includes('127.0.0.1') || url.includes('localhost')) {
        return url;
      }
    }
  }
  // Development fallback - only used in local development with local Supabase
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    // Check if local Supabase URL is set
    const localUrl = process.env.SUPABASE_URL || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_URL : null);
    if (localUrl && localUrl.includes('127.0.0.1')) {
      return localUrl;
    }
  }
  console.warn('🔧 Supabase URL not found in environment');
  // Return null to indicate Supabase is not configured
  return null;
}

const getSupabaseAnonKey = (): string | null => {
  // Check for Vite environment variables (client-side)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) {
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    console.log('🔧 Supabase Anon Key from VITE env:', key ? `set (length: ${key.length})` : 'not set');
    if (key && key.trim() !== '' && key.startsWith('eyJ')) {
      return key;
    }
  }
  // Check for Node.js environment variables (server-side)
  if (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) {
    const key = process.env.SUPABASE_ANON_KEY;
    if (key && key.trim() !== '' && key.startsWith('eyJ')) {
      return key;
    }
  }
  // Development fallback - only used in local development
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.log('🔧 Using development fallback anon key');
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  }
  console.warn('🔧 Supabase Anon Key not found in environment');
  // Return null to indicate Supabase is not configured
  return null;
}

// Check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return url !== null && key !== null;
}

// Lazy initialization to avoid errors during build
let _supabaseClient: ReturnType<typeof createClient> | null = null
let _supabaseConfigured: boolean | null = null

export const getSupabaseClient = () => {
  // Check if Supabase is configured
  if (_supabaseConfigured === null) {
    _supabaseConfigured = isSupabaseConfigured();
  }
  
  if (!_supabaseConfigured) {
    console.warn('Supabase is not configured - OAuth features will be unavailable');
    return null;
  }
  
  if (!_supabaseClient) {
    const supabaseUrl = getSupabaseUrl()!;
    const supabaseAnonKey = getSupabaseAnonKey()!;
    
    try {
      _supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      })
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      return null;
    }
  }
  return _supabaseClient
}

// Legacy export for backward compatibility - returns null if not configured
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    const client = getSupabaseClient();
    if (!client) {
      // Return a no-op function for method calls when Supabase is not configured
      if (typeof prop === 'string') {
        return () => {
          console.warn(`Supabase not configured - ${String(prop)} call ignored`);
          return Promise.resolve({ data: null, error: new Error('Supabase not configured') });
        };
      }
      return undefined;
    }
    return (client as any)[prop]
  }
})

// Get the app URL for OAuth redirects
const getAppUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.APP_URL || 'http://localhost:5173'
}

// For server-side operations that require elevated privileges
export const createServiceClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service operations')
  }
  
  const supabaseUrl = getSupabaseUrl()
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required for service operations')
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}