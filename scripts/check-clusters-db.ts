import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rpqhkfkbpwzqcsdafogw.supabase.co';
// Production service role key from Netlify
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3MTc4NSwiZXhwIjoyMDgxNzQ3Nzg1fQ.9ybfZt3-jUfOPUHl-u6gKhJwBTSmYKpRekw2qAN7ZI4';

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkClusters() {
  const now = new Date().toISOString();
  console.log('Current time:', now);
  console.log('Checking clusters in production database...\n');
  
  // Check clusters table with expiration info
  const { data: clusters, error: clustersError } = await supabase
    .from('clusters')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (clustersError) {
    console.error('Error fetching clusters:', clustersError);
  } else {
    console.log('Clusters in database:', clusters?.length || 0);
    if (clusters && clusters.length > 0) {
      clusters.forEach((c: any) => {
        const expired = c.expires_at && new Date(c.expires_at) < new Date();
        console.log(`  - ${c.title} (${c.article_count} articles)`);
        console.log(`    expires_at: ${c.expires_at} ${expired ? '(EXPIRED)' : '(valid)'}`);
      });
    }
  }
  
  // Check non-expired clusters
  const { data: validClusters, error: validError } = await supabase
    .from('clusters')
    .select('*')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('\nNon-expired clusters:', validClusters?.length || 0);
}

checkClusters();


async function checkClusterDetails() {
  console.log('\n--- Detailed Cluster Check ---');
  
  const { data: clusters, error } = await supabase
    .from('clusters')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  clusters?.forEach((c: any, i: number) => {
    console.log(`\nCluster ${i + 1}:`);
    console.log('  id:', c.id);
    console.log('  title:', c.title);
    console.log('  summary:', c.summary?.substring(0, 100) + '...');
    console.log('  article_count:', c.article_count);
    console.log('  source_feeds:', c.source_feeds);
    console.log('  timeframe_start:', c.timeframe_start);
    console.log('  timeframe_end:', c.timeframe_end);
    console.log('  expires_at:', c.expires_at);
    console.log('  avg_similarity:', c.avg_similarity);
    console.log('  relevance_score:', c.relevance_score);
  });
}

checkClusterDetails();
