import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { retrieveFromRagDataset } from '@/lib/services/rag-service'

/**
 * RAG 知识检索工具
 */
export function ragRetrieveTool() {
  return tool({
    description: `从外部知识库检索相关信息。

使用场景：
- 需要查询专业领域知识时
- 需要获取最新的产品文档、技术规范时
- 用户明确要求查询特定知识库时

输入参数：
- datasetName: 知识库名称（从可用列表中选择）
- query: 检索查询（清晰描述要查找的内容）
- top_k: 返回结果数量（可选，默认 3）

输出：
- 相关知识片段列表，包含内容和相关度评分`,

    parameters: z.object({
      datasetName: z.string().describe('知识库名称（从可用列表中选择）'),
      query: z.string().describe('检索查询，例如："React Hooks 的使用方法"'),
      top_k: z.number().optional().default(3).describe('返回结果数量，默认 3'),
    }),

    execute: async ({ datasetName, query, top_k = 3 }, context?: { userId?: string }) => {
      if (!context?.userId) {
        return {
          success: false,
          error: '用户未登录',
          records: [],
        }
      }

      try {
        // 1. 根据 datasetName 查找用户的知识库配置
        const dataset = await prisma.ragDataset.findFirst({
          where: {
            userId: context.userId,
            name: datasetName,
            enabled: true,
          },
        })

        if (!dataset) {
          return {
            success: false,
            error: `未找到名为 "${datasetName}" 的知识库，请检查名称是否正确`,
            records: [],
          }
        }

        // 2. 执行检索
        const result = await retrieveFromRagDataset({
          dataset,
          query,
          top_k,
        })

        return {
          success: true,
          records: result.records.map((r) => ({
            content: r.content,
            score: r.score,
            title: r.title,
          })),
          summary: `从知识库 "${datasetName}" 中检索到 ${result.records.length} 条相关信息`,
        }
      } catch (error: any) {
        return {
          success: false,
          error: error.message || '检索失败',
          records: [],
        }
      }
    },
  })
}
