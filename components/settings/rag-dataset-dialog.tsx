'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, AlertCircle } from 'lucide-react'
import type { RagDataset } from './rag-dataset-list'

interface Props {
  open: boolean
  dataset: RagDataset | null
  onClose: () => void
  onSave: () => void
}

export function RagDatasetDialog({ open, dataset, onClose, onSave }: Props) {
  console.log('🔍 RagDatasetDialog 渲染:', { open, dataset: dataset?.name || 'null' })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    purpose: '',
    datasetId: '',
    apiKey: '',
    apiEndpoint: 'https://api.dify.ai/v1',
    description: '',
    search_method: 'semantic_search' as 'semantic_search' | 'keyword_search' | 'full_text_search' | 'hybrid_search',
    reranking_enable: false,
    reranking_provider_name: '',
    reranking_model_name: '',
    top_k: 3,
    score_threshold: 0.5,
    score_threshold_enabled: true,
  })

  useEffect(() => {
    if (dataset) {
      const config = dataset.retrievalConfig 
        ? (typeof dataset.retrievalConfig === 'string' 
            ? JSON.parse(dataset.retrievalConfig) 
            : dataset.retrievalConfig)
        : {}
      
      setFormData({
        name: dataset.name,
        purpose: dataset.purpose,
        datasetId: dataset.datasetId,
        apiKey: '', // 不显示已保存的 API Key
        apiEndpoint: dataset.apiEndpoint || 'https://api.dify.ai/v1',
        description: dataset.description || '',
        search_method: config.search_method || 'semantic_search',
        reranking_enable: config.reranking_enable ?? false,
        reranking_provider_name: config.reranking_model?.reranking_provider_name || '',
        reranking_model_name: config.reranking_model?.reranking_model_name || '',
        top_k: config.top_k || 3,
        score_threshold: config.score_threshold || 0.5,
        score_threshold_enabled: config.score_threshold_enabled ?? true,
      })
    } else {
      setFormData({
        name: '',
        purpose: '',
        datasetId: '',
        apiKey: '',
        apiEndpoint: 'https://api.dify.ai/v1',
        description: '',
        search_method: 'semantic_search',
        reranking_enable: false,
        reranking_provider_name: '',
        reranking_model_name: '',
        top_k: 3,
        score_threshold: 0.5,
        score_threshold_enabled: true,
      })
    }
    setError(null)
  }, [dataset, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 验证必填字段
      if (!formData.name.trim()) {
        throw new Error('请输入知识库名称')
      }
      if (!formData.purpose.trim()) {
        throw new Error('请输入用途说明')
      }
      if (!formData.datasetId.trim()) {
        throw new Error('请输入 Dataset ID')
      }
      if (!dataset && !formData.apiKey.trim()) {
        throw new Error('请输入 API Key')
      }

      const url = dataset
        ? `/api/rag/datasets/${dataset.id}`
        : '/api/rag/datasets'
      
      const method = dataset ? 'PATCH' : 'POST'

      const body: any = {
        name: formData.name.trim(),
        purpose: formData.purpose.trim(),
        datasetId: formData.datasetId.trim(),
        apiEndpoint: formData.apiEndpoint.trim(),
        description: formData.description.trim() || undefined,
        // 暂时不保存 retrievalConfig，使用 Dify 知识库的默认配置
        // 原因：发送自定义检索参数需要配置嵌入模型，但 UI 暂不支持
        // retrievalConfig: null,
      }

      // 只在提供了 API Key 时才更新
      if (formData.apiKey.trim()) {
        body.apiKey = formData.apiKey.trim()
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || '保存失败')
      }

      onSave()
      onClose()
    } catch (error: any) {
      setError(error.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {dataset ? '编辑知识库' : '添加知识库'}
          </DialogTitle>
          <DialogDescription>
            配置外部 RAG 知识库，AI 可以从中检索专业知识
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            {/* 基本信息 */}
            <div className="space-y-2">
              <Label htmlFor="name">知识库名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="例如：React 官方文档"
                required
              />
              <p className="text-xs text-muted-foreground">
                给知识库起一个易于识别的名称
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">用途说明 *</Label>
              <Input
                id="purpose"
                value={formData.purpose}
                onChange={(e) =>
                  setFormData({ ...formData, purpose: e.target.value })
                }
                placeholder="例如：React 框架的使用方法和最佳实践"
                required
              />
              <p className="text-xs text-muted-foreground">
                用途说明会注入到 AI 提示词中，帮助 AI 选择合适的知识库
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">详细描述（可选）</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="知识库的详细说明..."
                rows={2}
              />
            </div>

            {/* Dify 配置 */}
            <div className="rounded-lg border p-4 space-y-4">
              <h4 className="font-semibold text-sm">Dify 配置</h4>
              
              <div className="space-y-2">
                <Label htmlFor="datasetId">Dataset ID *</Label>
                <Input
                  id="datasetId"
                  value={formData.datasetId}
                  onChange={(e) =>
                    setFormData({ ...formData, datasetId: e.target.value })
                  }
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  从 Dify 知识库设置中获取（UUID 格式）
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  API Key {dataset && '（留空表示不修改）'}
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apiKey: e.target.value })
                  }
                  placeholder={dataset ? '••••••••' : 'dataset-xxxxxx'}
                  required={!dataset}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  API Key 会加密存储，前端不会显示完整内容
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiEndpoint">API 端点</Label>
                <Input
                  id="apiEndpoint"
                  value={formData.apiEndpoint}
                  onChange={(e) =>
                    setFormData({ ...formData, apiEndpoint: e.target.value })
                  }
                  placeholder="https://api.dify.ai/v1"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Dify API 的基础 URL
                </p>
              </div>
            </div>

            {/* 检索参数 - 暂时隐藏，使用 Dify 知识库默认配置 */}
            {/* 原因：自定义检索参数需要配置嵌入模型，但 UI 暂不支持 */}
            {/* 未来如果需要支持，需要添加嵌入模型配置选项 */}
            <div className="rounded-lg border border-dashed bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                💡 检索参数将使用 Dify 知识库的默认配置（检索方法、Top-K、相关度阈值等）
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                如需自定义检索参数，请在 Dify 平台的知识库设置中配置
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dataset ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
