import { tool } from 'ai'
import { z } from 'zod'
import { searchWeb } from '../research'

/**
 * Web 搜索工具
 * 允许 agent 主动搜索互联网上的学习资源和信息
 */
export const researchTool = tool({
  description: `Search the web for learning resources, tutorials, documentation, or any information to help answer the user's questions. 
Use this when:
- The user asks about specific technologies, frameworks, or concepts
- You need up-to-date information or best practices
- The user wants to find learning materials or tutorials
- You need to verify or supplement your knowledge

Examples:
- "Find React hooks tutorials"
- "Search for Python data science resources"
- "Look up the latest Next.js documentation"`,
  
  parameters: z.object({
    query: z.string().describe('The search query - be specific and include relevant keywords'),
  }),
  
  execute: async ({ query }: { query: string }, context?: { abortSignal?: AbortSignal }) => {
    // 检查是否已中断
    if (context?.abortSignal?.aborted) {
      return {
        success: false,
        error: 'Search aborted by user',
        query,
      }
    }
    try {
      const results = await searchWeb(query, {
        abortSignal: context?.abortSignal,
      })
      
      return {
        success: true,
        query,
        results: results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
        })),
        summary: `Found ${results.length} result(s) for "${query}"`,
      }
    } catch (error) {
      // 检查是否为中断错误
      const isAborted = error instanceof Error && 
        (error.message.includes('aborted') || error.name === 'AbortError');
      
      console.error('Research tool error:', error)
      return {
        success: false,
        error: isAborted ? 'Search aborted by user' : (error instanceof Error ? error.message : 'Search failed'),
        query,
      }
    }
  },
})
