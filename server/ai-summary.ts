import OpenAI from 'openai';

// Initialize OpenAI client (lazy initialization)
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export interface ArticleSummary {
  points: string[];
  generatedAt: string;
  model: string;
}

/**
 * Generate AI summary for an article using OpenAI
 */
export async function generateArticleSummary(
  title: string,
  content: string,
  excerpt?: string
): Promise<ArticleSummary | null> {
  const client = getOpenAIClient();
  
  if (!client) {
    console.log('OpenAI API key not configured, using fallback summary');
    return null;
  }

  // Clean HTML from content
  const cleanContent = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 4000); // Limit content length for API

  const prompt = `Analyze this news article and provide exactly 3 key takeaways as bullet points. Each point should be a single, concise sentence that captures an important insight, fact, or implication from the article.

Title: ${title}

Content: ${cleanContent || excerpt || 'No content available'}

Respond with exactly 3 bullet points, each on a new line starting with "• ". Focus on:
1. The main news or announcement
2. A key detail, statistic, or quote
3. The broader implication or what happens next`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective model for summaries
      messages: [
        {
          role: 'system',
          content: 'You are a news analyst that creates concise, informative summaries. Be factual and avoid speculation. Each bullet point should be self-contained and informative.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.3, // Lower temperature for more consistent output
    });

    const summaryText = response.choices[0]?.message?.content || '';
    
    // Parse bullet points
    const points = summaryText
      .split('\n')
      .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
      .filter(line => line.length > 10)
      .slice(0, 3);

    if (points.length === 0) {
      return null;
    }

    return {
      points,
      generatedAt: new Date().toISOString(),
      model: 'gpt-4o-mini'
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return null;
  }
}

/**
 * Check if AI summaries are available (API key configured)
 */
export function isAISummaryAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
