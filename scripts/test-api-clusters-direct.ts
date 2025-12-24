/**
 * Test script to call the /api/clusters endpoint directly
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rpqhkfkbpwzqcsdafogw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3MTc4NSwiZXhwIjoyMDgxNzQ3Nzg1fQ.9ybfZt3-jUfOPUHl-u6gKhJwBTSmYKpRekw2qAN7ZI4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testApiClusters() {
  console.log('=== Testing /api/clusters endpoint ===\n');
  
  // First, sign in to get a session
  console.log('1. Signing in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123'
  });
  
  if (authError) {
    console.log('Auth error (expected if user does not exist):', authError.message);
    console.log('\nTrying to call API without auth to see error...');
  } else {
    console.log('Signed in as:', authData.user?.email);
  }
  
  // Call the API
  console.log('\n2. Calling /api/clusters...');
  const apiUrl = 'https://cronkite-v4.netlify.app/api/clusters';
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authData?.session?.access_token ? {
          'Authorization': `Bearer ${authData.session.access_token}`
        } : {})
      },
      credentials: 'include'
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.clusters) {
      console.log(`\nFound ${data.clusters.length} clusters`);
      data.clusters.forEach((c: any, i: number) => {
        console.log(`  ${i + 1}. "${c.topic}" (${c.articleCount} articles)`);
      });
    }
  } catch (error) {
    console.error('API call failed:', error);
  }
  
  console.log('\n=== Test Complete ===');
}

testApiClusters().catch(console.error);
