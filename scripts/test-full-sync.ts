import { createClient } from '@supabase/supabase-js';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

const supabase = createClient(
  'https://rpqhkfkbpwzqcsdafogw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwcWhrZmticHd6cWNzZGFmb2d3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3MTc4NSwiZXhwIjoyMDgxNzQ3Nzg1fQ.9ybfZt3-jUfOPUHl-u6gKhJwBTSmYKpRekw2qAN7ZI4'
);

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Cronkite News Aggregator/1.0 (+https://cronkite.app)',
    'Accept': 'application/rss+xml, application/xml, text/xml'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['description', 'description'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator']
    ]
  }
});

// User feeds to sync
const userFeeds = [
  { id: '34a82659-9210-405e-9480-e7c3adc787b4', name: '9to5Mac', url: 'https://9to5mac.com/feed/' },
  { id: '3b966a7e-42ab-42dd-96c3-9a3163881ca4', name: 'MacRumors', url: 'https://feeds.macrumors.com/MacRumors-All' },
  { id: 'a240c4f9-6548-40fb-af58-a7d441682245', name: 'Grazia', url: 'https://graziadaily.co.uk/feed/' },
  { id: 'ef083422-bc66-4541-9e1f-5aa60fe4fa05', name: 'OSXDaily', url: 'https://osxdaily.com/feed/' },
  { id: 'c3c60fe7-057f-4cfc-9743-aa9126383136', name: 'ATP Tour', url: 'https://www.atptour.com/en/media/rss-feed/xml-feed' },
  { id: 'c277d492-057a-49c1-95f0-39461de6d6bb', name: 'Harpers Bazaar', url: 'https://www.harpersbazaar.com/rss/all.xml/' },
  { id: '796ac1c2-1a4a-4f13-b959-944bbdb3ea68', name: 'Vogue', url: 'https://www.vogue.com/feed/rss' }
];

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]/g, ' ')
    .trim();
}

function extractContent(item: any): { content: string | null; excerpt: string | null } {
  let rawContent = item.contentEncoded || item['content:encoded'] || item.content || item.description || item.summary || '';
  
  if (!rawContent) {
    return { content: null, excerpt: null };
  }
  
  const $ = cheerio.load(rawContent);
  $('script, style').remove();
  const cleanContent = $.text().trim();
  
  const excerpt = cleanContent.length > 200 
    ? cleanContent.substring(0, 200).trim() + '...'
    : cleanContent;
  
  return {
    content: cleanContent || null,
    excerpt: excerpt || null
  };
}

function extractImageUrl(item: any): string | null {
  if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
    return item.enclosure.url;
  }
  
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
    return item.mediaContent.$.url;
  }
  
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
    return item.mediaThumbnail.$.url;
  }
  
  if (item.content || item.description) {
    const $ = cheerio.load(item.content || item.description);
    const firstImg = $('img').first();
    if (firstImg.length) {
      return firstImg.attr('src') || null;
    }
  }
  
  return null;
}

async function syncFeed(feed: { id: string; name: string; url: string }) {
  console.log(`\n📡 Syncing: ${feed.name}`);
  
  try {
    // Fetch RSS feed
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Cronkite News Aggregator/1.0 (+https://cronkite.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });
    
    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}`);
      return { success: false, articlesNew: 0 };
    }
    
    const feedContent = await response.text();
    const feedData = await parser.parseString(feedContent);
    
    console.log(`   📰 Found ${feedData.items?.length || 0} items`);
    
    let articlesNew = 0;
    const maxArticles = 20; // Limit per feed
    
    for (const item of (feedData.items || []).slice(0, maxArticles)) {
      const guid = item.guid || item.link || `generated-${Date.now()}-${Math.random()}`;
      
      // Check if article exists
      const { data: existing } = await supabase
        .from('articles')
        .select('id')
        .eq('feed_id', feed.id)
        .eq('guid', guid)
        .single();
      
      if (existing) continue;
      
      const title = cleanText(item.title || 'Untitled');
      const url = item.link || '';
      const author = item.creator || item['dc:creator'] || item.author || null;
      const publishedAt = item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate) : null;
      const { content, excerpt } = extractContent(item);
      const imageUrl = extractImageUrl(item);
      
      const { error: insertError } = await supabase
        .from('articles')
        .insert({
          feed_id: feed.id,
          guid,
          title,
          url,
          author,
          excerpt,
          content,
          image_url: imageUrl,
          published_at: publishedAt?.toISOString(),
          fetched_at: new Date().toISOString(),
          embedding: null
        });
      
      if (insertError) {
        console.log(`   ⚠️ Error inserting: ${insertError.message}`);
      } else {
        articlesNew++;
      }
    }
    
    console.log(`   ✅ Added ${articlesNew} new articles`);
    return { success: true, articlesNew };
    
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return { success: false, articlesNew: 0 };
  }
}

async function main() {
  console.log('=== Full RSS Sync Test ===');
  console.log(`Syncing ${userFeeds.length} feeds...\n`);
  
  let totalNew = 0;
  let successCount = 0;
  
  for (const feed of userFeeds) {
    const result = await syncFeed(feed);
    if (result.success) {
      successCount++;
      totalNew += result.articlesNew;
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Feeds synced: ${successCount}/${userFeeds.length}`);
  console.log(`New articles: ${totalNew}`);
  
  // Check total articles
  const { count } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total articles in database: ${count}`);
}

main().catch(console.error);
