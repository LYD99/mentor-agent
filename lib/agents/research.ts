import { z } from 'zod'
import { getEnv } from '@/lib/config/env-runtime'

const TavilyResponseSchema = z.object({
  results: z.array(z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
    score: z.number(),
  })),
})

export async function searchWeb(query: string) {
  const apiKey = getEnv('TAVILY_API_KEY')
  if (!apiKey) {
    console.warn('TAVILY_API_KEY not set, returning mock results')
    return [
      {
        title: `Mock result for: ${query}`,
        url: 'https://example.com',
        snippet: 'This is a mock search result for testing purposes.',
      },
    ]
  }
  
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: 5,
    }),
  })
  
  const data = await response.json()
  const parsed = TavilyResponseSchema.parse(data)
  
  return parsed.results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.content.slice(0, 300),
  }))
}
