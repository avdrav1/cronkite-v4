import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rpqhkfkbpwzqcsdafogw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNzE3ODUsImV4cCI6MjA4MTc0Nzc4NX0.HPpvbJC2aNKHzlpZ8vZ7FfLHDh-QQB_7y1fEg0Tz8ZE';

// Test user credentials
const testEmail = 'test@example.com';
const testPassword = 'test123';

async function testApiClusters() {
  console.log('Testing /api/clusters endpoint...\n');
  
  // First, sign in to get a token
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  console.log('1. Signing in to get auth token...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  
  if (authError) {
    console.error('Auth error:', authError.message);
    console.log('\nTrying to create test user...');
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    
    if (signUpError) {
      console.error('Sign up error:', signUpError.message);
      return;
    }
    
    console.log('Created test user, but may need email confirmation');
    return;
  }
  
  const token = authData.session?.access_token;
  console.log('Got token:', token ? 'Yes' : 'No');
  
  if (!token) {
    console.error('No token received');
    return;
  }
  
  // Now call the API
  console.log('\n2. Calling /api/clusters endpoint...');
  const apiUrl = 'https://cronkite-v4.netlify.app/api/clusters';
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('\nResponse data:');
    console.log('- clusters count:', data.clusters?.length || 0);
    console.log('- method:', data.method);
    console.log('- cached:', data.cached);
    console.log('- message:', data.message);
    
    if (data.clusters && data.clusters.length > 0) {
      console.log('\nFirst cluster:');
      console.log(JSON.stringify(data.clusters[0], null, 2));
    }
  } catch (error) {
    console.error('API call error:', error);
  }
}

testApiClusters();
