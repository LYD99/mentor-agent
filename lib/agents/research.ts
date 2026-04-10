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

/**
 * 增强的网络搜索功能
 * 返回更详细的搜索结果，包括评分和更长的内容摘要
 */
export async function searchWeb(
  query: string,
  options?: {
    maxResults?: number
    searchDepth?: 'basic' | 'advanced'
    includeAnswer?: boolean
    abortSignal?: AbortSignal
  }
) {
  // 检查是否已中断
  if (options?.abortSignal?.aborted) {
    throw new Error('Search operation aborted by user')
  }
  
  const apiKey = getEnv('TAVILY_API_KEY')
  if (!apiKey) {
    console.warn('TAVILY_API_KEY not set, returning mock results')
    return [
      {
        title: `Mock result for: ${query}`,
        url: 'https://example.com',
        snippet: 'This is a mock search result for testing purposes.',
        score: 0.5,
      },
    ]
  }
  
  const maxResults = options?.maxResults || 8 // 增加默认结果数
  const searchDepth = options?.searchDepth || 'advanced' // 使用更深入的搜索
  
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_answer: options?.includeAnswer || false,
    }),
    signal: options?.abortSignal,
  })
  
  if (!response.ok) {
    console.error('Tavily API error:', response.status, response.statusText)
    throw new Error(`Tavily API error: ${response.status}`)
  }
  
  const data = await response.json()
  const parsed = TavilyResponseSchema.parse(data)
  
  // 按评分排序，返回更详细的结果
  return parsed.results
    .sort((a, b) => b.score - a.score)
    .map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 500), // 增加摘要长度
      score: r.score,
    }))
}

/**
 * 格式化研究结果为更专业的摘要
 */
export function formatResearchSummary(results: Array<{
  title: string
  url: string
  snippet: string
  score: number
}>): string {
  if (results.length === 0) {
    return 'No research results found.'
  }
  
  // 按评分分组：高质量 (>0.7), 中等质量 (0.4-0.7), 其他
  const highQuality = results.filter(r => r.score > 0.7)
  const mediumQuality = results.filter(r => r.score >= 0.4 && r.score <= 0.7)
  
  let summary = '## Research Findings\n\n'
  
  if (highQuality.length > 0) {
    summary += '### High-Quality Sources:\n'
    highQuality.forEach((r, i) => {
      summary += `${i + 1}. **${r.title}**\n`
      summary += `   - URL: ${r.url}\n`
      summary += `   - Relevance: ${(r.score * 100).toFixed(0)}%\n`
      summary += `   - Summary: ${r.snippet}\n\n`
    })
  }
  
  if (mediumQuality.length > 0) {
    summary += '### Additional Sources:\n'
    mediumQuality.forEach((r, i) => {
      summary += `${i + 1}. **${r.title}** (${r.url})\n`
      summary += `   ${r.snippet.slice(0, 200)}...\n\n`
    })
  }
  
  return summary
}
