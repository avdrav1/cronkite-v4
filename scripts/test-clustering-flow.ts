/**
 * Test script to verify the exact clustering flow used in /api/clusters
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rpqhkfkbpwzqcsdafogw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3MTc4NSwiZXhwIjoyMDgxNzQ3Nzg1fQ.9ybfZt3-jUfOPUHl-u6gKhJwBTSmYKpRekw2qAN7ZI4';

async function testClusteringFlow() {
  console.log('=== Testing Clustering Flow ===\n');
  
  // Set environment variables to simulate production
  process.env.SUPABASE_URL = supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = supabaseKey;
  process.env.NODE_ENV = 'production';
  
  console.log('1. Importing storage module...');
  const { getStorage } = await import('../server/storage');
  
  console.log('2. Getting storage instance...');
  const storage = await getStorage();
  console.log('   Storage type:', storage.constructor.name);
  
  console.log('\n3. Importing clustering service...');
  const { createClusteringServiceManager } = await import('../server/clustering-service');
  
  console.log('4. Creating clustering service manager...');
  const clusteringService = createClusteringServiceManager(storage as any);
  
  console.log('\n5. Calling getUserClusters(undefined, 10)...');
  try {
    const clusters = await clusteringService.getUserClusters(undefined, 10);
    console.log(`   Result: ${clusters.length} clusters returned`);
    
    if (clusters.length > 0) {
      console.log('\n   Clusters found:');
      clusters.forEach((c, i) => {
        console.log(`   ${i + 1}. "${c.topic}" (${c.articleCount} articles, relevance: ${c.relevanceScore})`);
      });
    } else {
      console.log('\n   ⚠️ No clusters returned!');
    }
  } catch (error) {
    console.error('   ❌ Error:', error);
  }
  
  console.log('\n6. Direct test of storage.getClusters()...');
  try {
    // @ts-ignore - accessing getClusters directly
    if (typeof storage.getClusters === 'function') {
      const directClusters = await (storage as any).getClusters({
        userId: undefined,
        includeExpired: false,
        limit: 10
      });
      console.log(`   Direct result: ${directClusters.length} clusters`);
      if (directClusters.length > 0) {
        console.log('   First cluster:', directClusters[0].title);
      }
    } else {
      console.log('   ⚠️ storage.getClusters is not a function!');
      console.log('   Available methods:', Object.keys(storage).filter(k => typeof (storage as any)[k] === 'function'));
    }
  } catch (error) {
    console.error('   ❌ Error:', error);
  }
  
  console.log('\n=== Test Complete ===');
}

testClusteringFlow().catch(console.error);
