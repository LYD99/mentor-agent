'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, CheckCircle2, XCircle, AlertCircle, Search } from 'lucide-react'

interface TestResult {
  success: boolean
  message: string
  records?: Array<{
    content: string
    score: number
    title?: string
  }>
}

interface Props {
  open: boolean
  datasetId: string
  datasetName: string
  onClose: () => void
}

export function RagTestDialog({ open, datasetId, datasetName, onClose }: Props) {
  const [query, setQuery] = useState('测试查询')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const handleTest = async () => {
    if (!query.trim()) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch(`/api/rag/datasets/${datasetId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: query.trim() }),
      })

      const data = await res.json()
      setResult(data)
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || '测试失败',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setQuery('测试查询')
    setResult(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>测试知识库检索</DialogTitle>
          <DialogDescription>
            测试 <span className="font-semibold">{datasetName}</span> 的检索功能
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 输入查询 */}
          <div className="space-y-2">
            <Label htmlFor="query">测试问题</Label>
            <div className="flex gap-2">
              <Input
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="输入要测试的问题..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleTest()
                  }
                }}
              />
              <Button onClick={handleTest} disabled={loading || !query.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    测试中
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    测试
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              输入问题后点击测试，查看知识库的检索结果
            </p>
          </div>

          {/* 测试结果 */}
          {result && (
            <div className="space-y-3">
              {/* 状态提示 */}
              <div
                className={`rounded-lg border p-4 flex items-start gap-3 ${
                  result.success
                    ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-semibold ${
                      result.success
                        ? 'text-green-900 dark:text-green-100'
                        : 'text-red-900 dark:text-red-100'
                    }`}
                  >
                    {result.success ? '✅ 连接成功' : '❌ 连接失败'}
                  </p>
                  <p
                    className={`text-sm mt-1 ${
                      result.success
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    {result.message}
                  </p>
                </div>
              </div>

              {/* 检索结果 */}
              {result.success && result.records && result.records.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">检索结果</h4>
                    <span className="text-xs text-muted-foreground">
                      共 {result.records.length} 条
                    </span>
                  </div>

                  {result.records.map((record, index) => (
                    <div
                      key={index}
                      className="rounded-lg border bg-card p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">
                            #{index + 1}
                          </span>
                          {record.title && (
                            <span className="text-sm font-medium">
                              {record.title}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                            {(record.score * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {record.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 无结果提示 */}
              {result.success && (!result.records || result.records.length === 0) && (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    未检索到相关内容
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    尝试调整问题或检查知识库内容
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
