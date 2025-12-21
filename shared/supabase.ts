import { createClient } from '@supabase/supabase-js'

// For client-side usage, we need to use Vite's import.meta.env
// For server-side, we use process.env
const getSupabaseUrl = (): string => {
  // Check for Vite environment variables (client-side)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) {
    return import.meta.env.VITE_SUPABASE_URL
  }
  // Check for Node.js environment variables (server-side)
  if (typeof process !== 'undefined' && process.env?.SUPABASE_URL) {
    return process.env.SUPABASE_URL
  }
  // Development fallback - only used in local development
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return 'http://localhost:54321'
  }
  throw new Error('SUPABASE_URL environment variable is required')
}

const getSupabaseAnonKey = (): string => {
  // Check for Vite environment variables (client-side)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) {
    return import.meta.env.VITE_SUPABASE_ANON_KEY
  }
  // Check for Node.js environment variables (server-side)
  if (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) {
    return process.env.SUPABASE_ANON_KEY
  }
  // Development fallback - only used in local development
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  }
  throw new Error('SUPABASE_ANON_KEY environment variable is required')
}

// Lazy initialization to avoid errors during build
let _supabaseClient: ReturnType<typeof createClient> | null = null

export const getSupabaseClient = () => {
  if (!_supabaseClient) {
    const supabaseUrl = getSupabaseUrl()
    const supabaseAnonKey = getSupabaseAnonKey()
    
    _supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  }
  return _supabaseClient
}

// Legacy export for backward compatibility
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    return (getSupabaseClient() as any)[prop]
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
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}