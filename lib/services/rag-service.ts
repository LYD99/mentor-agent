import { EncryptionService } from './encryption-service'

interface RetrievalConfig {
  search_method?: 'semantic_search' | 'keyword_search' | 'full_text_search' | 'hybrid_search'
  reranking_enable?: boolean
  reranking_model?: {
    reranking_provider_name?: string
    reranking_model_name?: string
  }
  top_k?: number
  score_threshold?: number
  score_threshold_enabled?: boolean
}

interface RetrievalRecord {
  content: string
  score: number
  title?: string
  metadata?: any
}

interface RetrievalResult {
  records: RetrievalRecord[]
  total: number
}

// Dataset 类型定义（从 Prisma 模型中提取需要的字段）
interface RagDataset {
  id: string
  datasetId: string
  apiKey: string
  apiEndpoint: string
  retrievalConfig: string | null
}

export class RagService {
  /**
   * 从 Dify 知识库检索
   */
  static async retrieveFromRagDataset(params: {
    dataset: RagDataset
    query: string
    top_k?: number
    score_threshold?: number
  }): Promise<RetrievalResult> {
    const { dataset, query, top_k, score_threshold } = params

    // 解密 API Key
    const apiKey = EncryptionService.decrypt(dataset.apiKey)

    // 调用 Dify API
    const url = `${dataset.apiEndpoint}/datasets/${dataset.datasetId}/retrieve`
    
    // 根据 Dify API 文档构建请求体
    // 策略：不发送 retrieval_model，让 Dify 使用知识库的默认配置
    // 原因：
    // 1. 发送 retrieval_model 需要完整的配置（包括嵌入模型）
    // 2. 我们的 UI 目前不支持配置嵌入模型
    // 3. 使用知识库默认配置更简单可靠
    // 
    // 未来如果需要支持自定义检索参数，需要：
    // - 在 UI 中添加嵌入模型配置选项
    // - 或者只支持 keyword_search/full_text_search（不需要嵌入模型）
    const requestBody: any = {
      query,
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Dify API 错误 (${response.status}): ${error}`)
    }

    const data = await response.json()

    // 转换 Dify 响应格式
    // 根据 Dify API 文档，响应结构为: { query: {...}, records: [{segment: {...}, score: ...}] }
    const records: RetrievalRecord[] = (data.records || []).map((record: any) => ({
      content: record.segment?.content || record.content || '',
      score: record.score || 0,
      title: record.segment?.document?.name || record.title,
      metadata: {
        document_id: record.segment?.document_id,
        document_name: record.segment?.document?.name,
        position: record.segment?.position,
        ...record.segment?.document?.doc_metadata,
      },
    }))

    return {
      records,
      total: records.length,
    }
  }

  /**
   * 测试知识库连接
   */
  static async testConnection(params: {
    datasetId: string
    apiKey: string
    apiEndpoint: string
    query?: string
  }): Promise<{ success: boolean; message: string; records?: RetrievalRecord[] }> {
    try {
      const url = `${params.apiEndpoint}/datasets/${params.datasetId}/retrieve`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: params.query || 'test',
          // 测试连接时不发送 retrieval_model，使用知识库默认配置
          // 这样可以避免因缺少嵌入模型配置导致的错误
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        return {
          success: false,
          message: `连接失败 (${response.status}): ${error}`,
        }
      }

      const data = await response.json()
      const records: RetrievalRecord[] = (data.records || []).map((record: any) => ({
        content: record.segment?.content || record.content || '',
        score: record.score || 0,
        title: record.segment?.document?.name || record.title,
      }))

      return {
        success: true,
        message: '连接成功',
        records: records.slice(0, 1),
      }
    } catch (error: any) {
      return {
        success: false,
        message: `连接失败: ${error.message}`,
      }
    }
  }
}

// 导出便捷函数
export const retrieveFromRagDataset = RagService.retrieveFromRagDataset
export const testRagConnection = RagService.testConnection
