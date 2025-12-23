/**
 * Test text-based clustering with Anthropic
 */

import 'dotenv/config';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const DATABASE_URL = 'postgresql://postgres:nfDhPjBAXX2AB37Wd-wE@db.rpqhkfkbpwzqcsdafogw.supabase.co:5432/postgres';

// Check if ANTHROPIC_API_KEY is set
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface ArticleCluster {
  id: string;
  topic: string;
  summary: string;
  articleIds: string[];
  articleCount: number;
  sources: string[];
  latestTimestamp: string;
  relevanceScore: number;
}

async function clusterArticles(
  articles: Array<{ id: string; title: string; excerpt?: string; source: string; published_at?: string }>
): Promise<ArticleCluster[]> {
  console.log(`🔍 clusterArticles called with ${articles.length} articles`);
  
  if (!ANTHROPIC_API_KEY) {
    console.log('⚠️ ANTHROPIC_API_KEY not set');
    return [];
  }
  
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  
  if (articles.length < 3) {
    console.log(`⚠️ Not enough articles for clustering (need 3+, have ${articles.length})`);
    return [];
  }

  // Prepare article summaries for clustering
  const articleSummaries = articles.slice(0, 50).map((a, i) => 
    `[${i}] "${a.title}" (${a.source})`
  ).join('\n');

  const prompt = `Analyze these news article titles and identify 3-5 trending topics where multiple articles from DIFFERENT sources cover the same story or theme.

Articles:
${articleSummaries}

For each trending topic cluster, provide:
- A short topic name (2-5 words)
- A one-sentence summary of the story
- The article indices that belong to this cluster (comma-separated numbers)

IMPORTANT: Only create clusters where at least 2 articles from DIFFERENT sources cover the same topic.

Format each cluster on a new line as:
TOPIC: [topic name] | SUMMARY: [one sentence] | ARTICLES: [comma-separated indices]

Only output the clusters, nothing else.`;

  try {
    console.log('🤖 Calling Anthropic API for clustering...');
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log(`🤖 Anthropic response received, length: ${responseText.length}`);
    console.log('Response:', responseText);
    
    // Parse clusters
    const clusters: ArticleCluster[] = [];
    const lines = responseText.split('\n').filter(l => l.includes('TOPIC:'));
    
    console.log(`🔍 Found ${lines.length} potential cluster lines`);
    
    for (const line of lines) {
      const topicMatch = line.match(/TOPIC:\s*([^|]+)/);
      const summaryMatch = line.match(/SUMMARY:\s*([^|]+)/);
      const articlesMatch = line.match(/ARTICLES:\s*([0-9,\s]+)/);
      
      if (topicMatch && summaryMatch && articlesMatch) {
        const topic = topicMatch[1].trim();
        const summary = summaryMatch[1].trim();
        const indices = articlesMatch[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        
        // Get the actual articles for this cluster
        const clusterArticles = indices
          .filter(i => i >= 0 && i < articles.length)
          .map(i => articles[i]);
        
        // Only include clusters with 2+ articles from different sources
        const uniqueSources = Array.from(new Set(clusterArticles.map(a => a.source)));
        if (clusterArticles.length >= 2 && uniqueSources.length >= 2) {
          const latestDate = clusterArticles
            .map(a => a.published_at)
            .filter(Boolean)
            .sort()
            .reverse()[0] || new Date().toISOString();
          
          clusters.push({
            id: `cluster-${Date.now()}-${clusters.length}`,
            topic,
            summary,
            articleIds: clusterArticles.map(a => a.id),
            articleCount: clusterArticles.length,
            sources: uniqueSources,
            latestTimestamp: latestDate,
            relevanceScore: clusterArticles.length * uniqueSources.length
          });
          
          console.log(`✅ Created cluster: "${topic}" with ${clusterArticles.length} articles from ${uniqueSources.length} sources`);
        }
      }
    }
    
    console.log(`📊 Total clusters created: ${clusters.length}`);
    
    return clusters.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
  } catch (error) {
    console.error('❌ Clustering error:', error);
    return [];
  }
}

async function testTextClustering() {
  console.log('🧪 Testing text-based clustering\n');
  
  // Check API key
  if (!ANTHROPIC_API_KEY) {
    console.log('❌ ANTHROPIC_API_KEY environment variable not set');
    console.log('Please set it: export ANTHROPIC_API_KEY=your-key-here');
    return;
  }
  console.log('✅ ANTHROPIC_API_KEY is set\n');

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database\n');

    // Get recent articles with their feed names
    const articlesResult = await client.query(`
      SELECT a.id, a.title, a.excerpt, f.name as source, a.published_at
      FROM articles a
      JOIN feeds f ON a.feed_id = f.id
      WHERE a.published_at > NOW() - INTERVAL '48 hours'
      ORDER BY a.published_at DESC
      LIMIT 50
    `);
    
    console.log(`📊 Found ${articlesResult.rows.length} recent articles\n`);
    
    if (articlesResult.rows.length < 3) {
      console.log('⚠️ Not enough articles for clustering');
      return;
    }

    // Show sample articles
    console.log('📋 Sample articles:');
    articlesResult.rows.slice(0, 5).forEach((a: any, i: number) => {
      console.log(`  [${i}] "${a.title}" (${a.source})`);
    });
    console.log('');

    // Test clustering
    const articles = articlesResult.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      source: row.source,
      published_at: row.published_at?.toISOString()
    }));

    const clusters = await clusterArticles(articles);
    
    console.log('\n📊 Final clusters:');
    clusters.forEach((c, i) => {
      console.log(`\n${i + 1}. ${c.topic}`);
      console.log(`   Summary: ${c.summary}`);
      console.log(`   Articles: ${c.articleCount} from ${c.sources.length} sources`);
      console.log(`   Sources: ${c.sources.join(', ')}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testTextClustering();
