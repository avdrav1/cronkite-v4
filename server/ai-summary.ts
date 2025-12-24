import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client (lazy initialization)
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export interface ArticleSummary {
  points: string[];
  generatedAt: string;
  model: string;
}

export interface ArticleCluster {
  id: string;
  topic: string;
  summary: string;
  articleIds: string[];
  articleCount: number;
  sources: string[];
  latestTimestamp: string;
  relevanceScore: number;
}

/**
 * Generate AI summary for an article using Anthropic Claude
 */
export async function generateArticleSummary(
  title: string,
  content: string,
  excerpt?: string
): Promise<ArticleSummary | null> {
  const client = getAnthropicClient();
  
  if (!client) {
    console.log('Anthropic API key not configured, using fallback summary');
    return null;
  }

  // Clean HTML from content
  const cleanContent = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 6000); // Claude can handle more context

  const prompt = `Analyze this news article and provide exactly 3 key takeaways. Each should be a single, insightful sentence that captures important information.

Title: ${title}

Content: ${cleanContent || excerpt || 'No content available'}

Provide exactly 3 bullet points:
1. The main news or announcement (what happened)
2. A key detail, statistic, quote, or context
3. The broader implication or what this means going forward

Format your response as exactly 3 lines, each starting with "• ". Be concise and factual.`;

  try {
    console.log('Calling Anthropic API for summary...');
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307', // Fast and cost-effective
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
    });

    console.log('Anthropic API response received');
    const summaryText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('Summary text:', summaryText.substring(0, 100));
    
    // Parse bullet points
    const points = summaryText
      .split('\n')
      .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter(line => line.length > 10)
      .slice(0, 3);

    if (points.length === 0) {
      console.log('No valid points parsed from response');
      return null;
    }

    return {
      points,
      generatedAt: new Date().toISOString(),
      model: 'claude-3-haiku'
    };
  } catch (error) {
    console.error('Anthropic API error:', error);
    return null;
  }
}


/**
 * Cluster articles by topic using AI
 * Groups related articles from different sources into trending topics
 */
export async function clusterArticles(
  articles: Array<{ id: string; title: string; excerpt?: string; source: string; published_at?: string }>
): Promise<ArticleCluster[]> {
  const client = getAnthropicClient();
  
  console.log(`🔍 clusterArticles called with ${articles.length} articles, client available: ${!!client}`);
  
  if (!client) {
    console.log('⚠️ Anthropic client not available for clustering');
    return [];
  }
  
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
            relevanceScore: clusterArticles.length * uniqueSources.length // Simple relevance score
          });
          
          console.log(`✅ Created cluster: "${topic}" with ${clusterArticles.length} articles from ${uniqueSources.length} sources`);
        }
      }
    }
    
    console.log(`📊 Total clusters created: ${clusters.length}`);
    
    // Sort by relevance score
    return clusters.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
  } catch (error) {
    console.error('❌ Clustering error:', error);
    return [];
  }
}

/**
 * Check if AI features are available
 */
export function isAISummaryAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function isClusteringAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
