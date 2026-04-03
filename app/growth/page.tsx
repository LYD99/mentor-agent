'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Map, Trash2 } from 'lucide-react'
import { ModuleShell } from '@/components/layout/module-shell'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type GrowthMapItem = {
  id: string
  title: string
  description: string | null
  status: string
  updatedAt: string
}

export default function GrowthMapsPage() {
  const router = useRouter()
  const [maps, setMaps] = useState<GrowthMapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadMaps()
  }, [])

  const loadMaps = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/growth-map/list', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setMaps(data.maps || [])
      }
    } catch (err) {
      console.error('Failed to load maps:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, mapId: string, mapTitle: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm(`确定要删除成长地图「${mapTitle}」吗？\n\n此操作将删除所有关联的学习计划、学习资料和报告，且无法恢复。`)) {
      return
    }

    setDeletingId(mapId)
    try {
      const response = await fetch(`/api/growth-map/${mapId}/delete`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadMaps()
      } else {
        const result = await response.json()
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete map error:', error)
      alert('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <ModuleShell title="成长地图">
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <p className="mb-6 text-sm text-muted-foreground">
          查看并管理你的学习路径。在 Mentor 中生成地图后，会出现在此列表。
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">加载中...</p>
            </div>
          </div>
        ) : maps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
            <Map className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-4 text-sm text-muted-foreground">还没有成长地图。</p>
            <Link
              href="/mentor"
              className={cn(buttonVariants({ className: 'mt-6' }))}
            >
              去 Mentor 创建
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {maps.map((m) => (
              <li key={m.id} className="group relative">
                <Link
                  href={`/plan/${m.id}`}
                  className="block rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {m.status === 'draft'
                            ? '草稿'
                            : m.status === 'pending_plan'
                              ? '待规划'
                              : m.status === 'planned'
                                ? '已规划'
                                : m.status === 'learning'
                                  ? '学习中'
                                  : m.status}
                        </span>
                      </div>
                      {m.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {m.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        更新于 {new Date(m.updatedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(e, m.id, m.title)}
                      disabled={deletingId === m.id}
                      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingId === m.id ? '删除中...' : '删除'}
                    </Button>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ModuleShell>
  )
}
