'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Database, TestTube, Edit, Trash } from 'lucide-react'
import { RagTestDialog } from './rag-test-dialog'

export interface RagDataset {
  id: string
  name: string
  purpose: string
  datasetId: string
  enabled: boolean
  description?: string
  order: number
  apiEndpoint: string
  retrievalConfig?: {
    top_k: number
    score_threshold: number
    score_threshold_enabled: boolean
  }
  createdAt: string
  updatedAt: string
}

interface Props {
  datasets: RagDataset[]
  onEdit: (dataset: RagDataset) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}

export function RagDatasetList({ datasets, onEdit, onDelete, onRefresh }: Props) {
  const [toggling, setToggling] = useState<string | null>(null)
  const [testingDataset, setTestingDataset] = useState<RagDataset | null>(null)

  const handleToggle = async (id: string, enabled: boolean) => {
    setToggling(id)
    try {
      const res = await fetch(`/api/rag/datasets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '更新失败')
      }
      
      onRefresh()
    } catch (error) {
      alert(`更新失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setToggling(null)
    }
  }

  const handleTest = (dataset: RagDataset) => {
    setTestingDataset(dataset)
  }

  if (datasets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Database className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">暂无知识库配置</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          添加外部知识库，让 AI 可以检索更多专业知识
        </p>
      </div>
    )
  }

  return (
    <>
      <RagTestDialog
        open={!!testingDataset}
        datasetId={testingDataset?.id || ''}
        datasetName={testingDataset?.name || ''}
        onClose={() => setTestingDataset(null)}
      />

      <div className="space-y-3">
        {datasets.map((dataset) => (
        <div
          key={dataset.id}
          className="flex items-start justify-between rounded-lg border p-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="font-semibold truncate">{dataset.name}</h3>
              {!dataset.enabled && (
                <Badge variant="secondary">已禁用</Badge>
              )}
            </div>
            <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
              用途: {dataset.purpose}
            </p>
            {dataset.description && (
              <p className="mb-2 text-xs text-muted-foreground line-clamp-1">
                {dataset.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="font-mono">ID: {dataset.datasetId.slice(0, 8)}...</span>
              {dataset.retrievalConfig && (
                <>
                  <span>Top-K: {dataset.retrievalConfig.top_k}</span>
                  <span>阈值: {dataset.retrievalConfig.score_threshold}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {toggling === dataset.id ? '更新中...' : dataset.enabled ? '已启用' : '已禁用'}
              </span>
              <Switch
                checked={dataset.enabled}
                onCheckedChange={(checked) => handleToggle(dataset.id, checked)}
                disabled={toggling === dataset.id}
              />
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTest(dataset)}
              disabled={!dataset.enabled}
            >
              <TestTube className="mr-2 h-4 w-4" />
              测试
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(dataset)}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(dataset.id)}
                  className="text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        ))}
      </div>
    </>
  )
}
