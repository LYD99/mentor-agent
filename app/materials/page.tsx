'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  FileText,
  Calendar,
  TrendingUp,
  BarChart3,
  Plus,
  Home,
  Filter,
  Search,
  Folder,
  Grid3x3,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type MaterialCategory = 'all' | 'daily' | 'weekly' | 'monthly' | 'materials'
type ViewMode = 'grid' | 'folder'

type Material = {
  id: string
  category: MaterialCategory
  title: string
  type?: string
  contentMarkdown: string
  createdAt: string
  reportDate?: string
  weekStartDate?: string
  year?: number
  month?: number
  mapId?: string | null
  taskId?: string | null
  sourceTable?: 'LearningMaterial' | 'LearningLesson'
}

type GrowthMapInfo = {
  id: string
  title: string
}

const categoryConfig = {
  all: { label: '全部', icon: FileText, color: 'text-gray-600' },
  daily: { label: '日报', icon: Calendar, color: 'text-blue-600' },
  weekly: { label: '周报', icon: TrendingUp, color: 'text-purple-600' },
  monthly: { label: '月报', icon: BarChart3, color: 'text-emerald-600' },
  materials: { label: '学习资料', icon: FileText, color: 'text-rose-600' },
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [growthMaps, setGrowthMaps] = useState<GrowthMapInfo[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadMaterials()
    loadGrowthMaps()
  }, [selectedCategory])

  const loadMaterials = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory !== 'all') {
        params.set('type', selectedCategory)
      }
      params.set('limit', '50')

      const res = await fetch(`/api/materials?${params.toString()}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setMaterials(data.materials || [])
      }
    } catch (err) {
      console.error('Failed to load materials:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadGrowthMaps = async () => {
    try {
      const res = await fetch('/api/growth-map/list', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setGrowthMaps(data.maps || [])
      }
    } catch (err) {
      console.error('Failed to load growth maps:', err)
    }
  }

  const toggleFolder = (mapId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(mapId)) {
        next.delete(mapId)
      } else {
        next.add(mapId)
      }
      return next
    })
  }

  const handleDeleteMaterial = async (e: React.MouseEvent, material: Material) => {
    e.preventDefault()
    e.stopPropagation()

    const itemType = material.sourceTable === 'LearningLesson' ? '讲义' : '学习资料'
    if (!confirm(`确定要删除${itemType}「${material.title}」吗？\n\n此操作无法恢复。`)) {
      return
    }

    setDeletingId(material.id)
    try {
      const deleteUrl = material.sourceTable === 'LearningLesson'
        ? `/api/lesson/${material.id}/delete`
        : `/api/materials/${material.id}/delete`
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadMaterials()
      } else {
        const result = await response.json()
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete material error:', error)
      alert('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteFolder = async (e: React.MouseEvent, folderId: string, folderTitle: string, materialsCount: number) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm(`确定要删除文件夹「${folderTitle}」及其下的所有资料吗？\n\n这将删除 ${materialsCount} 份资料，包括讲义和学习资料。\n\n此操作无法恢复。`)) {
      return
    }

    setDeletingId(folderId)
    try {
      // 使用批量删除 API，一条 SQL 删除所有资料
      const response = await fetch('/api/materials/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          mapId: folderId === 'no-map' ? null : folderId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete folder')
      }

      const result = await response.json()
      console.log('Batch delete result:', result)
      
      // 显示删除结果
      if (result.success) {
        alert(result.message)
      }

      // 刷新列表
      await loadMaterials()
    } catch (error) {
      console.error('Delete folder error:', error)
      alert(error instanceof Error ? error.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredMaterials = materials.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getCategoryLabel = (material: Material) => {
    const config = categoryConfig[material.category]
    return config?.label || material.category
  }

  const getDateDisplay = (material: Material) => {
    if (material.reportDate) {
      return new Date(material.reportDate).toLocaleDateString('zh-CN')
    }
    if (material.weekStartDate) {
      return `${new Date(material.weekStartDate).toLocaleDateString('zh-CN')} 起`
    }
    if (material.year && material.month) {
      return `${material.year}年${material.month}月`
    }
    return formatDistanceToNow(new Date(material.createdAt), {
      addSuffix: true,
      locale: zhCN,
    })
  }

  const getMaterialLink = (material: Material) => {
    // 如果是 LearningLesson，跳转到讲义详情页
    if (material.sourceTable === 'LearningLesson') {
      return `/lesson/${material.id}`
    }
    // 否则跳转到 /materials/[id] 详情页
    return `/materials/${material.id}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">学习资料</h1>
            <p className="mt-2 text-muted-foreground">
              管理你的日报、周报、月报和学习笔记
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                返回首页
              </Button>
            </Link>
            <Link href="/materials/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                新建资料
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Category Filter */}
            <div className="flex gap-2 overflow-x-auto">
              {(Object.keys(categoryConfig) as MaterialCategory[]).map((cat) => {
                const config = categoryConfig[cat]
                const Icon = config.icon
                const isActive = selectedCategory === cat

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all whitespace-nowrap',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </button>
                )
              })}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜索资料..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* View Mode Toggle - Only show for materials category */}
          {selectedCategory === 'materials' && (
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                  viewMode === 'grid'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                )}
              >
                <Grid3x3 className="h-4 w-4" />
                网格视图
              </button>
              <button
                onClick={() => setViewMode('folder')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                  viewMode === 'folder'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                )}
              >
                <Folder className="h-4 w-4" />
                文件夹视图
              </button>
            </div>
          )}
        </div>

        {/* Materials List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">加载中...</p>
            </div>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">暂无资料</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {searchQuery
                ? '没有找到匹配的资料'
                : '开始创建你的第一份学习资料'}
            </p>
            {!searchQuery && (
              <Link href="/materials/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  新建资料
                </Button>
              </Link>
            )}
          </div>
        ) : viewMode === 'folder' && selectedCategory === 'materials' ? (
          // Folder View - Group by Growth Map
          <div className="space-y-4">
            {/* Materials with Growth Map */}
            {growthMaps.map((map) => {
              const mapMaterials = filteredMaterials.filter(
                (m) => m.mapId === map.id && m.category === 'materials'
              )
              if (mapMaterials.length === 0) return null

              const isExpanded = expandedFolders.has(map.id)

              return (
                <div key={map.id} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 p-4 hover:bg-muted/50 transition-colors">
                    <button
                      onClick={() => toggleFolder(map.id)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <Folder className="h-5 w-5 text-rose-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground">{map.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {mapMaterials.length} 份资料
                        </p>
                      </div>
                      <div className="text-muted-foreground">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFolder(e, map.id, map.title, mapMaterials.length)}
                      disabled={deletingId === map.id}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all flex-shrink-0"
                      title="删除文件夹及所有资料"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 p-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {mapMaterials.map((material) => {
                          const config = categoryConfig[material.category]
                          const Icon = config.icon

                          return (
                            <div key={material.id} className="group/card relative">
                              <Link
                                href={getMaterialLink(material)}
                                className="block relative overflow-hidden rounded-lg border border-border bg-card p-4 transition-all hover:shadow-md"
                              >
                                <div className="mb-3 flex items-start justify-between">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
                                    <Icon className={cn('h-4 w-4', config.color)} />
                                  </div>
                                  {material.sourceTable === 'LearningLesson' && (
                                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                                      讲义
                                    </span>
                                  )}
                                </div>

                                <h4 className="mb-2 line-clamp-2 text-sm font-semibold pr-8">
                                  {material.title}
                                </h4>

                                <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                                  {material.contentMarkdown.slice(0, 100)}...
                                </p>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {getDateDisplay(material)}
                                </div>
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteMaterial(e, material)}
                                disabled={deletingId === material.id}
                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover/card:opacity-100 z-10"
                                title="删除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Materials without Growth Map */}
            {(() => {
              const unmappedMaterials = filteredMaterials.filter(
                (m) => !m.mapId && m.category === 'materials'
              )
              if (unmappedMaterials.length === 0) return null

              const isExpanded = expandedFolders.has('no-map')

              return (
                <div className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center gap-2 p-4 hover:bg-muted/50 transition-colors">
                    <button
                      onClick={() => toggleFolder('no-map')}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <Folder className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground">其他资料</h3>
                        <p className="text-sm text-muted-foreground">
                          {unmappedMaterials.length} 份资料
                        </p>
                      </div>
                      <div className="text-muted-foreground">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFolder(e, 'no-map', '其他资料', unmappedMaterials.length)}
                      disabled={deletingId === 'no-map'}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all flex-shrink-0"
                      title="删除文件夹及所有资料"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 p-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {unmappedMaterials.map((material) => {
                          const config = categoryConfig[material.category]
                          const Icon = config.icon

                          return (
                            <div key={material.id} className="group/card relative">
                              <Link
                                href={getMaterialLink(material)}
                                className="block relative overflow-hidden rounded-lg border border-border bg-card p-4 transition-all hover:shadow-md"
                              >
                                <div className="mb-3 flex items-start justify-between">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
                                    <Icon className={cn('h-4 w-4', config.color)} />
                                  </div>
                                  {material.sourceTable === 'LearningLesson' && (
                                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                                      讲义
                                    </span>
                                  )}
                                </div>

                                <h4 className="mb-2 line-clamp-2 text-sm font-semibold pr-8">
                                  {material.title}
                                </h4>

                                <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                                  {material.contentMarkdown.slice(0, 100)}...
                                </p>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {getDateDisplay(material)}
                                </div>
                              </Link>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteMaterial(e, material)}
                                disabled={deletingId === material.id}
                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover/card:opacity-100 z-10"
                                title="删除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        ) : (
          // Grid View - Original view for all categories or when grid mode selected
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMaterials.map((material) => {
              const config = categoryConfig[material.category]
              const Icon = config.icon

              return (
                <div key={material.id} className="group/card relative">
                  <Link
                    href={getMaterialLink(material)}
                    className="block relative overflow-hidden rounded-lg border border-border bg-card p-6 transition-all hover:shadow-lg"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          material.category === 'daily' && 'bg-blue-100',
                          material.category === 'weekly' && 'bg-purple-100',
                          material.category === 'monthly' && 'bg-emerald-100',
                          material.category === 'materials' && 'bg-rose-100'
                        )}
                      >
                        <Icon className={cn('h-5 w-5', config.color)} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            'rounded-full px-2 py-1 text-xs font-medium',
                            material.category === 'daily' &&
                              'bg-blue-100 text-blue-700',
                            material.category === 'weekly' &&
                              'bg-purple-100 text-purple-700',
                            material.category === 'monthly' &&
                              'bg-emerald-100 text-emerald-700',
                            material.category === 'materials' &&
                              'bg-rose-100 text-rose-700'
                          )}
                        >
                          {getCategoryLabel(material)}
                        </span>
                        {material.sourceTable === 'LearningLesson' && (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                            讲义
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="mb-2 line-clamp-2 text-lg font-semibold pr-8">
                      {material.title}
                    </h3>

                    <p className="mb-4 line-clamp-3 text-sm text-muted-foreground">
                      {material.contentMarkdown.slice(0, 150)}...
                    </p>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {getDateDisplay(material)}
                    </div>
                  </Link>
                  {material.category === 'materials' && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteMaterial(e, material)}
                      disabled={deletingId === material.id}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover/card:opacity-100 z-10"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
