import { describe, it, expect } from 'vitest'
import { formatRagDatasetsForPrompt } from '@/lib/services/rag-prompt-builder'

describe('RAG Prompt Builder', () => {
  describe('formatRagDatasetsForPrompt', () => {
    it('should format empty dataset list', () => {
      const result = formatRagDatasetsForPrompt([])
      expect(result).toBe('')
    })

    it('should format single dataset', () => {
      const datasets = [
        {
          name: 'React Docs',
          purpose: 'React framework usage and best practices',
          description: 'Official React documentation',
        },
      ]

      const result = formatRagDatasetsForPrompt(datasets)

      expect(result).toContain('可用知识库')
      expect(result).toContain('React Docs')
      expect(result).toContain('React framework usage and best practices')
      expect(result).toContain('Official React documentation')
    })

    it('should format multiple datasets', () => {
      const datasets = [
        {
          name: 'React Docs',
          purpose: 'React framework',
          description: 'React documentation',
        },
        {
          name: 'TypeScript Docs',
          purpose: 'TypeScript language',
          description: 'TypeScript documentation',
        },
      ]

      const result = formatRagDatasetsForPrompt(datasets)

      expect(result).toContain('React Docs')
      expect(result).toContain('TypeScript Docs')
      expect(result).toContain('React framework')
      expect(result).toContain('TypeScript language')
    })

    it('should handle dataset without description', () => {
      const datasets = [
        {
          name: 'Test Dataset',
          purpose: 'Testing purposes',
          description: null,
        },
      ]

      const result = formatRagDatasetsForPrompt(datasets)

      expect(result).toContain('Test Dataset')
      expect(result).toContain('Testing purposes')
      expect(result).not.toContain('Description:')
    })

    it('should include usage instructions', () => {
      const datasets = [
        {
          name: 'Test Dataset',
          purpose: 'Testing',
          description: null,
        },
      ]

      const result = formatRagDatasetsForPrompt(datasets)

      expect(result).toContain('rag_retrieve')
      expect(result).toContain('使用建议')
    })

    it('should format datasets with special characters', () => {
      const datasets = [
        {
          name: 'C++ Guide',
          purpose: 'C++ programming & best practices',
          description: 'Learn C++ (modern)',
        },
      ]

      const result = formatRagDatasetsForPrompt(datasets)

      expect(result).toContain('C++ Guide')
      expect(result).toContain('C++ programming & best practices')
      expect(result).toContain('Learn C++ (modern)')
    })

    it('should handle long dataset lists', () => {
      const datasets = Array.from({ length: 10 }, (_, i) => ({
        name: `Dataset ${i + 1}`,
        purpose: `Purpose ${i + 1}`,
        description: `Description ${i + 1}`,
      }))

      const result = formatRagDatasetsForPrompt(datasets)

      // 应该包含所有数据集
      datasets.forEach(ds => {
        expect(result).toContain(ds.name)
        expect(result).toContain(ds.purpose)
      })
    })
  })
})
