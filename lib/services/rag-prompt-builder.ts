import { prisma } from '@/lib/db'

interface RagDatasetInfo {
  name: string
  purpose: string
  description?: string | null
}

/**
 * 构建 RAG 知识库列表文本（用于注入到 Agent 提示词）
 */
export async function buildRagDatasetsPrompt(userId: string): Promise<string> {
  // 加载用户的 RAG 知识库配置
  const ragDatasets = await prisma.ragDataset.findMany({
    where: { userId, enabled: true },
    orderBy: { order: 'asc' },
    select: {
      name: true,
      purpose: true,
      description: true,
    },
  })

  if (ragDatasets.length === 0) {
    return '' // 没有配置知识库,返回空字符串
  }

  // 构建知识库列表文本
  const datasetsText = ragDatasets
    .map(
      (d, i) => `${i + 1}. **${d.name}**
   - 用途: ${d.purpose}
   ${d.description ? `- 说明: ${d.description}` : ''}`
    )
    .join('\n')

  return `

可用知识库：
${datasetsText}

使用建议：
- 当用户询问与上述知识库相关的问题时，优先使用 rag_retrieve 工具
- 根据用户问题的主题，选择最合适的知识库
- 可以组合使用多个知识库的结果
- 知识库中的信息通常比网络搜索更准确、更专业
`
}

/**
 * 格式化 RAG 数据集信息（用于直接传递给提示词构建函数）
 */
export function formatRagDatasetsForPrompt(datasets: RagDatasetInfo[]): string {
  if (datasets.length === 0) {
    return ''
  }

  const datasetsText = datasets
    .map(
      (d, i) => `${i + 1}. **${d.name}**
   - 用途: ${d.purpose}
   ${d.description ? `- 说明: ${d.description}` : ''}`
    )
    .join('\n')

  return `

可用知识库：
${datasetsText}

使用建议：
- 当用户询问与上述知识库相关的问题时，优先使用 rag_retrieve 工具
- 根据用户问题的主题，选择最合适的知识库
- 可以组合使用多个知识库的结果
- 知识库中的信息通常比网络搜索更准确、更专业
`
}
