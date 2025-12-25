/**
 * Feed Health Audit Script
 * 
 * Tests all recommended feeds to check:
 * 1. If the feed URL is accessible
 * 2. If it returns valid RSS/Atom content
 * 3. How many articles it has in the past 30 days
 * 
 * Usage: npx tsx scripts/audit-feed-health.ts
 */

import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Cronkite/1.0 (RSS Reader; +https://cronkite.app)',
    'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*'
  }
});

interface FeedHealthResult {
  id: string;
  name: string;
  url: string;
  category: string;
  status: 'healthy' | 'error' | 'empty' | 'stale';
  httpStatus?: number;
  error?: string;
  totalArticles: number;
  articlesLast30Days: number;
  latestArticleDate?: string;
  responseTimeMs: number;
}

async function testFeed(feed: { id: string; name: string; url: string; category: string }): Promise<FeedHealthResult> {
  const startTime = Date.now();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const parsed = await parser.parseURL(feed.url);
    const responseTime = Date.now() - startTime;
    
    const items = parsed.items || [];
    const totalArticles = items.length;
    
    // Count articles from last 30 days
    let articlesLast30Days = 0;
    let latestDate: Date | null = null;
    
    for (const item of items) {
      const pubDate = item.pubDate || item.isoDate;
      if (pubDate) {
        const articleDate = new Date(pubDate);
        if (!latestDate || articleDate > latestDate) {
          latestDate = articleDate;
        }
        if (articleDate >= thirtyDaysAgo) {
          articlesLast30Days++;
        }
      }
    }
    
    // Determine status
    let status: FeedHealthResult['status'] = 'healthy';
    if (totalArticles === 0) {
      status = 'empty';
    } else if (articlesLast30Days === 0) {
      status = 'stale';
    }
    
    return {
      id: feed.id,
      name: feed.name,
      url: feed.url,
      category: feed.category || 'Uncategorized',
      status,
      totalArticles,
      articlesLast30Days,
      latestArticleDate: latestDate?.toISOString(),
      responseTimeMs: responseTime
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    // Try to extract HTTP status if available
    let httpStatus: number | undefined;
    let errorMessage = error.message || 'Unknown error';
    
    if (error.message?.includes('Status code')) {
      const match = error.message.match(/Status code (\d+)/);
      if (match) {
        httpStatus = parseInt(match[1], 10);
      }
    }
    
    return {
      id: feed.id,
      name: feed.name,
      url: feed.url,
      category: feed.category || 'Uncategorized',
      status: 'error',
      httpStatus,
      error: errorMessage,
      totalArticles: 0,
      articlesLast30Days: 0,
      responseTimeMs: responseTime
    };
  }
}

async function main() {
  console.log('🔍 Feed Health Audit');
  console.log('====================\n');
  
  // Fetch all recommended feeds
  const { data: feeds, error } = await supabase
    .from('recommended_feeds')
    .select('id, name, url, category')
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  
  if (error) {
    console.error('❌ Failed to fetch feeds:', error.message);
    process.exit(1);
  }
  
  console.log(`📊 Testing ${feeds.length} feeds...\n`);
  
  const results: FeedHealthResult[] = [];
  const batchSize = 10; // Test 10 feeds concurrently
  
  for (let i = 0; i < feeds.length; i += batchSize) {
    const batch = feeds.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(testFeed));
    results.push(...batchResults);
    
    // Progress update
    const progress = Math.min(i + batchSize, feeds.length);
    const healthy = results.filter(r => r.status === 'healthy').length;
    const errors = results.filter(r => r.status === 'error').length;
    console.log(`Progress: ${progress}/${feeds.length} (${healthy} healthy, ${errors} errors)`);
  }
  
  // Categorize results
  const healthy = results.filter(r => r.status === 'healthy');
  const errors = results.filter(r => r.status === 'error');
  const empty = results.filter(r => r.status === 'empty');
  const stale = results.filter(r => r.status === 'stale');
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total feeds tested: ${results.length}`);
  console.log(`✅ Healthy: ${healthy.length} (${(healthy.length/results.length*100).toFixed(1)}%)`);
  console.log(`❌ Errors: ${errors.length} (${(errors.length/results.length*100).toFixed(1)}%)`);
  console.log(`📭 Empty: ${empty.length} (${(empty.length/results.length*100).toFixed(1)}%)`);
  console.log(`⏰ Stale (no articles in 30 days): ${stale.length} (${(stale.length/results.length*100).toFixed(1)}%)`);
  
  // Show errors by category
  if (errors.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ FEEDS WITH ERRORS');
    console.log('='.repeat(80));
    
    const errorsByCategory = errors.reduce((acc, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    }, {} as Record<string, FeedHealthResult[]>);
    
    for (const [category, categoryErrors] of Object.entries(errorsByCategory)) {
      console.log(`\n📁 ${category}:`);
      for (const feed of categoryErrors) {
        console.log(`  ❌ ${feed.name}`);
        console.log(`     URL: ${feed.url}`);
        console.log(`     Error: ${feed.error}`);
        if (feed.httpStatus) {
          console.log(`     HTTP Status: ${feed.httpStatus}`);
        }
      }
    }
  }
  
  // Show stale feeds
  if (stale.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('⏰ STALE FEEDS (no articles in 30 days)');
    console.log('='.repeat(80));
    
    for (const feed of stale) {
      console.log(`  ⏰ ${feed.name} (${feed.category})`);
      console.log(`     Last article: ${feed.latestArticleDate || 'Unknown'}`);
      console.log(`     Total articles in feed: ${feed.totalArticles}`);
    }
  }
  
  // Show empty feeds
  if (empty.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('📭 EMPTY FEEDS (no articles at all)');
    console.log('='.repeat(80));
    
    for (const feed of empty) {
      console.log(`  📭 ${feed.name} (${feed.category})`);
      console.log(`     URL: ${feed.url}`);
    }
  }
  
  // Show healthy feeds summary by category
  console.log('\n' + '='.repeat(80));
  console.log('✅ HEALTHY FEEDS BY CATEGORY');
  console.log('='.repeat(80));
  
  const healthyByCategory = healthy.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = { count: 0, totalArticles: 0 };
    acc[r.category].count++;
    acc[r.category].totalArticles += r.articlesLast30Days;
    return acc;
  }, {} as Record<string, { count: number; totalArticles: number }>);
  
  for (const [category, stats] of Object.entries(healthyByCategory).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  📁 ${category}: ${stats.count} feeds, ${stats.totalArticles} articles (30 days)`);
  }
  
  // Write detailed results to JSON file
  const outputPath = 'scripts/feed-health-report.json';
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      healthy: healthy.length,
      errors: errors.length,
      empty: empty.length,
      stale: stale.length
    },
    results: results.sort((a, b) => {
      // Sort by status (errors first), then by category, then by name
      const statusOrder = { error: 0, empty: 1, stale: 2, healthy: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    })
  };
  
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${outputPath}`);
}

main().catch(console.error);
