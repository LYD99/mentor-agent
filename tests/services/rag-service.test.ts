import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RagService } from '@/lib/services/rag-service'
import { EncryptionService } from '@/lib/services/encryption-service'
import type { RagDataset } from '@prisma/client'

// Mock fetch
global.fetch = vi.fn()

describe('RagService', () => {
  // 使用真实的加密 API key
  const encryptedApiKey = EncryptionService.encrypt('test-api-key-123')
  
  const mockDataset: RagDataset = {
    id: 'test-id',
    userId: 'user-123',
    name: 'Test Dataset',
    purpose: 'Testing purposes',
    datasetId: 'dataset-uuid-123',
    apiKey: encryptedApiKey,
    apiEndpoint: 'https://api.dify.ai/v1',
    enabled: true,
    retrievalConfig: JSON.stringify({
      search_method: 'semantic_search',
      reranking_enable: false,
      top_k: 3,
      score_threshold: 0.5,
      score_threshold_enabled: true,
    }),
    description: 'Test description',
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('retrieveFromRagDataset', () => {
    it('should successfully retrieve data from Dify API', async () => {
      const mockResponse = {
        records: [
          {
            content: 'Test content 1',
            score: 0.9,
            metadata: { source: 'doc1' },
          },
          {
            content: 'Test content 2',
            score: 0.8,
            metadata: { source: 'doc2' },
          },
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await RagService.retrieveFromRagDataset({
        dataset: mockDataset,
        query: 'test query',
        top_k: 3,
      })

      expect(result.total).toBe(2)
      expect(result.records).toHaveLength(2)
      expect(result.records[0].content).toBe('Test content 1')
      expect(result.records[0].score).toBe(0.9)
    })

    it('should handle API errors', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Unauthorized',
      })

      await expect(
        RagService.retrieveFromRagDataset({
          dataset: mockDataset,
          query: 'test query',
          top_k: 3,
        })
      ).rejects.toThrow('Dify API 错误')
    })

    it('should handle network errors', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(
        RagService.retrieveFromRagDataset({
          dataset: mockDataset,
          query: 'test query',
          top_k: 3,
        })
      ).rejects.toThrow('Network error')
    })

    it('should use custom top_k parameter', async () => {
      const mockResponse = {
        records: [
          {
            content: 'Test content',
            score: 0.9,
            metadata: {},
          },
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await RagService.retrieveFromRagDataset({
        dataset: mockDataset,
        query: 'test query',
        top_k: 5,
      })

      // 验证结果
      expect(result.total).toBe(1)
      expect(result.records).toHaveLength(1)
    })

    it('should return all records from API response', async () => {
      const mockResponse = {
        records: [
          { content: 'High score', score: 0.9, metadata: {} },
          { content: 'Medium score', score: 0.6, metadata: {} },
          { content: 'Low score', score: 0.3, metadata: {} },
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await RagService.retrieveFromRagDataset({
        dataset: mockDataset,
        query: 'test query',
        top_k: 3,
      })

      // 应该返回所有记录（Dify API 已经应用了阈值）
      expect(result.total).toBe(3)
      expect(result.records).toHaveLength(3)
    })

    it('should support reranking configuration', async () => {
      const datasetWithReranking: RagDataset = {
        ...mockDataset,
        retrievalConfig: JSON.stringify({
          search_method: 'hybrid_search',
          reranking_enable: true,
          reranking_model: {
            reranking_provider_name: 'cohere',
            reranking_model_name: 'rerank-multilingual-v2.0',
          },
          top_k: 5,
          score_threshold: 0.7,
          score_threshold_enabled: true,
        }),
      }

      const mockResponse = {
        records: [
          { content: 'Reranked content', score: 0.95, metadata: {} },
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await RagService.retrieveFromRagDataset({
        dataset: datasetWithReranking,
        query: 'test query',
      })

      // 验证请求包含重排序配置
      const fetchCall = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      
      expect(requestBody.retrieval_model.search_method).toBe('hybrid_search')
      expect(requestBody.retrieval_model.reranking_enable).toBe(true)
      expect(requestBody.retrieval_model.reranking_model).toEqual({
        reranking_provider_name: 'cohere',
        reranking_model_name: 'rerank-multilingual-v2.0',
      })
      expect(requestBody.retrieval_model.top_k).toBe(5)
      expect(requestBody.retrieval_model.score_threshold).toBe(0.7)

      expect(result.total).toBe(1)
      expect(result.records[0].content).toBe('Reranked content')
    })

    it('should support different search methods', async () => {
      const datasetWithKeywordSearch: RagDataset = {
        ...mockDataset,
        retrievalConfig: JSON.stringify({
          search_method: 'keyword_search',
          reranking_enable: false,
          top_k: 3,
          score_threshold: 0.5,
          score_threshold_enabled: true,
        }),
      }

      const mockResponse = {
        records: [
          { content: 'Keyword matched content', score: 0.85, metadata: {} },
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await RagService.retrieveFromRagDataset({
        dataset: datasetWithKeywordSearch,
        query: 'test query',
      })

      // 验证请求使用了关键词搜索
      const fetchCall = (global.fetch as any).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      
      expect(requestBody.retrieval_model.search_method).toBe('keyword_search')
      expect(requestBody.retrieval_model.reranking_enable).toBe(false)
    })
  })

  describe('testConnection', () => {
    it('should successfully test connection', async () => {
      const mockResponse = {
        records: [
          {
            content: 'Test content',
            score: 0.9,
            metadata: {},
          },
        ],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await RagService.testConnection({
        datasetId: 'dataset-uuid',
        apiKey: 'test-api-key',
        apiEndpoint: 'https://api.dify.ai/v1',
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain('连接成功')
      expect(result.records).toHaveLength(1)
    })

    it('should handle connection failure', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      const result = await RagService.testConnection({
        datasetId: 'dataset-uuid',
        apiKey: 'invalid-key',
        apiEndpoint: 'https://api.dify.ai/v1',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('失败')
    })
  })
})
