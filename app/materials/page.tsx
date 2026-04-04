'use client'

import { useState, useEffect, Suspense } from 'react'
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
  Upload,
  FolderTree,
  ArrowLeft,
  ChevronRight,
  X,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { FolderManager, type FolderNode } from '@/components/materials/folder-manager'
import { BatchUploadDialog } from '@/components/materials/batch-upload-dialog'
import { useSearchParams } from 'next/navigation'

type MaterialCategory = 'all' | 'daily' | 'weekly' | 'monthly' | 'materials'
type ViewMode = 'grid' | 'growth-map' | 'folder-tree'

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
  folderId?: string | null
  sourceTable?: 'LearningMaterial' | 'LearningLesson'
  planDate?: string | null // 关联的学习计划日期
}

type GrowthMapInfo = {
  id: string
  title: string
}

type DailyPlanInfo = {
  mapId: string
  planDate: string
  taskId: string
}

const categoryConfig = {
  all: { label: '全部', icon: FileText, color: 'text-gray-600' },
  daily: { label: '日报', icon: Calendar, color: 'text-blue-600' },
  weekly: { label: '周报', icon: TrendingUp, color: 'text-purple-600' },
  monthly: { label: '月报', icon: BarChart3, color: 'text-emerald-600' },
  materials: { label: '学习资料', icon: FileText, color: 'text-rose-600' },
}

function MaterialsPageContent() {
  const searchParams = useSearchParams()
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [growthMaps, setGrowthMaps] = useState<GrowthMapInfo[]>([])
  const [dailyPlans, setDailyPlans] = useState<DailyPlanInfo[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  // 新增：文件夹相关状态
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  
  // 新增：日期范围过滤状态
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    startDate: string | null
    endDate: string | null
  }>({ startDate: null, endDate: null })
  const [dateFilterType, setDateFilterType] = useState<'created' | 'plan'>('created') // 筛选类型：创建时间 or 计划时间
  const [selectedMapIdFromUrl, setSelectedMapIdFromUrl] = useState<string | null>(null)

  // 初始化：从 URL 参数读取视图模式、地图ID和日期范围
  useEffect(() => {
    const view = searchParams.get('view') as ViewMode | null
    const mapId = searchParams.get('mapId')
    const planDate = searchParams.get('planDate')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    if (view && ['grid', 'growth-map', 'folder-tree'].includes(view)) {
      setViewMode(view)
      setSelectedCategory('materials') // 自动切换到学习资料分类
    }
    
    if (mapId) {
      setSelectedMapIdFromUrl(mapId)
      setExpandedFolders(new Set([mapId])) // 自动展开对应的成长地图
    }
    
    // 如果有 planDate，转换为日期范围（当天）
    if (planDate) {
      setDateRangeFilter({
        startDate: planDate,
        endDate: planDate,
      })
    } else if (startDate || endDate) {
      setDateRangeFilter({
        startDate: startDate || null,
        endDate: endDate || null,
      })
    }
  }, [searchParams])
  
  useEffect(() => {
    loadMaterials()
    loadGrowthMaps()
    loadFolders()
    loadDailyPlans()
  }, [selectedCategory, selectedFolderId, viewMode])
  
  // 切换视图模式时，如果不是文件夹视图，清除文件夹选择
  useEffect(() => {
    if (viewMode !== 'folder-tree' && selectedFolderId) {
      setSelectedFolderId(null)
    }
  }, [viewMode])

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
        let allMaterials = data.materials || []
        
        // 只在文件夹视图模式下，才根据 selectedFolderId 过滤资料
        if (viewMode === 'folder-tree' && selectedFolderId) {
          allMaterials = allMaterials.filter((m: Material) => m.folderId === selectedFolderId)
        }
        
        setMaterials(allMaterials)
      }
    } catch (err) {
      console.error('Failed to load materials:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadFolders = async () => {
    try {
      const res = await fetch('/api/materials/folders', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setFolders(data.folders || [])
      }
    } catch (err) {
      console.error('Failed to load folders:', err)
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

  const loadDailyPlans = async () => {
    try {
      const res = await fetch('/api/daily-plans', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setDailyPlans(data.plans || [])
      }
    } catch (err) {
      console.error('Failed to load daily plans:', err)
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
    // 日报 - 显示报告日期
    if (material.reportDate) {
      return new Date(material.reportDate).toLocaleDateString('zh-CN')
    }
    // 周报 - 显示起始日期
    if (material.weekStartDate) {
      return `${new Date(material.weekStartDate).toLocaleDateString('zh-CN')} 起`
    }
    // 月报 - 显示年月
    if (material.year && material.month) {
      return `${material.year}年${material.month}月`
    }
    // 默认显示创建时间（相对时间）
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

  // 获取选中文件夹的信息（用于面包屑导航）
  const getSelectedFolderInfo = (folderId: string | null): { name: string; path: string[]; parentId: string | null } | null => {
    if (!folderId) return null
    
    const findFolder = (folders: FolderNode[], targetId: string, path: string[] = []): { name: string; path: string[]; parentId: string | null } | null => {
      for (const folder of folders) {
        const currentPath = [...path, folder.name]
        if (folder.id === targetId) {
          return { name: folder.name, path: currentPath, parentId: folder.parentId || null }
        }
        if (folder.children.length > 0) {
          const result = findFolder(folder.children, targetId, currentPath)
          if (result) return result
        }
      }
      return null
    }
    
    return findFolder(folders, folderId)
  }

  // 返回上一级文件夹
  const handleGoBack = () => {
    const folderInfo = getSelectedFolderInfo(selectedFolderId)
    if (folderInfo?.parentId) {
      // 有父文件夹，返回到父文件夹
      setSelectedFolderId(folderInfo.parentId)
    } else {
      // 没有父文件夹，返回到根目录（文件夹列表）
      setSelectedFolderId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-7xl px-4 py-8">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadDialogOpen(true)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              批量导入
            </Button>
            <Link href="/materials/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                新建资料
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
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
              <div className="relative flex-1 sm:max-w-xs">
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
                  onClick={() => setViewMode('growth-map')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                    viewMode === 'growth-map'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  )}
                >
                  <Folder className="h-4 w-4" />
                  成长地图视图
                </button>
                <button
                  onClick={() => setViewMode('folder-tree')}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                    viewMode === 'folder-tree'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  )}
                >
                  <FolderTree className="h-4 w-4" />
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
        ) : viewMode === 'folder-tree' && selectedCategory === 'materials' ? (
          // Folder Tree View - Show folder manager with materials
          <div className="space-y-4">
            {/* Breadcrumb Navigation */}
            {selectedFolderId && (() => {
              const folderInfo = getSelectedFolderInfo(selectedFolderId)
              const hasParent = folderInfo?.parentId
              const path = folderInfo?.path || []
              
              return (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGoBack}
                    className="gap-2 flex-shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {hasParent ? '返回上一级' : '返回文件夹列表'}
                  </Button>
                  
                  {/* Breadcrumb Path */}
                  <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
                    <Folder className="h-4 w-4 flex-shrink-0" />
                    {path.map((name, index) => (
                      <div key={index} className="flex items-center gap-1 flex-shrink-0">
                        {index > 0 && <ChevronRight className="h-3 w-3" />}
                        <span className={cn(
                          index === path.length - 1 ? 'font-medium text-foreground' : ''
                        )}>
                          {name}
                        </span>
                      </div>
                    ))}
                    <span className="text-xs ml-2 flex-shrink-0">
                      ({filteredMaterials.length} 份资料)
                    </span>
                  </div>
                </div>
              )
            })()}
            
            {/* Folder Manager - Only show when no folder is selected */}
            {!selectedFolderId && (
              <div className="rounded-lg border border-border bg-card p-4">
                <FolderManager
                  folders={folders}
                  materials={materials}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                  onRefresh={() => {
                    loadFolders()
                    loadMaterials()
                  }}
                  onMaterialClick={(materialId) => {
                    const material = materials.find((m) => m.id === materialId)
                    if (material) {
                      window.location.href = getMaterialLink(material)
                    }
                  }}
                  onDeleteMaterial={(materialId) => {
                    const material = materials.find((m) => m.id === materialId)
                    if (material) {
                      handleDeleteMaterial(new MouseEvent('click') as any, material)
                    }
                  }}
                />
              </div>
            )}
            
            {/* Materials in selected folder */}
            {selectedFolderId && (
              <>
                {filteredMaterials.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredMaterials.map((material) => {
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
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
                    <Folder className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mb-2 text-lg font-semibold">文件夹为空</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      这个文件夹还没有任何资料
                    </p>
                    <Link href="/materials/new">
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        添加资料
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        ) : viewMode === 'growth-map' && selectedCategory === 'materials' ? (
          // Growth Map View - Group by Growth Map
          <div className="space-y-4">
            {/* 日期范围过滤器 */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">按日期范围筛选</h3>
                    
                    {/* 筛选类型切换 */}
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
                      <button
                        onClick={() => setDateFilterType('created')}
                        className={cn(
                          'px-3 py-1 text-xs font-medium rounded-md transition-all',
                          dateFilterType === 'created'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        创建时间
                      </button>
                      <button
                        onClick={() => setDateFilterType('plan')}
                        className={cn(
                          'px-3 py-1 text-xs font-medium rounded-md transition-all',
                          dateFilterType === 'plan'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        计划时间
                      </button>
                    </div>
                  </div>
                  
                  {/* 快捷日期选择 */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0]
                        const newFilter = { startDate: today, endDate: today }
                        setDateRangeFilter(newFilter)
                        
                        const url = new URL(window.location.href)
                        url.searchParams.set('startDate', today)
                        url.searchParams.set('endDate', today)
                        url.searchParams.delete('planDate')
                        window.history.replaceState({}, '', url.toString())
                      }}
                      className="text-xs"
                    >
                      今天
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date()
                        const sevenDaysAgo = new Date(today)
                        sevenDaysAgo.setDate(today.getDate() - 7)
                        
                        const start = sevenDaysAgo.toISOString().split('T')[0]
                        const end = today.toISOString().split('T')[0]
                        const newFilter = { startDate: start, endDate: end }
                        setDateRangeFilter(newFilter)
                        
                        const url = new URL(window.location.href)
                        url.searchParams.set('startDate', start)
                        url.searchParams.set('endDate', end)
                        url.searchParams.delete('planDate')
                        window.history.replaceState({}, '', url.toString())
                      }}
                      className="text-xs"
                    >
                      最近7天
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date()
                        const thirtyDaysAgo = new Date(today)
                        thirtyDaysAgo.setDate(today.getDate() - 30)
                        
                        const start = thirtyDaysAgo.toISOString().split('T')[0]
                        const end = today.toISOString().split('T')[0]
                        const newFilter = { startDate: start, endDate: end }
                        setDateRangeFilter(newFilter)
                        
                        const url = new URL(window.location.href)
                        url.searchParams.set('startDate', start)
                        url.searchParams.set('endDate', end)
                        url.searchParams.delete('planDate')
                        window.history.replaceState({}, '', url.toString())
                      }}
                      className="text-xs"
                    >
                      最近30天
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                      开始日期
                    </label>
                    <Input
                      type="date"
                      value={dateRangeFilter.startDate || ''}
                      onChange={(e) => {
                        const newFilter = {
                          ...dateRangeFilter,
                          startDate: e.target.value || null,
                        }
                        setDateRangeFilter(newFilter)
                        
                        // 更新 URL 参数
                        const url = new URL(window.location.href)
                        if (e.target.value) {
                          url.searchParams.set('startDate', e.target.value)
                        } else {
                          url.searchParams.delete('startDate')
                        }
                        url.searchParams.delete('planDate')
                        window.history.replaceState({}, '', url.toString())
                      }}
                      className="h-9"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
                      结束日期
                    </label>
                    <Input
                      type="date"
                      value={dateRangeFilter.endDate || ''}
                      onChange={(e) => {
                        const newFilter = {
                          ...dateRangeFilter,
                          endDate: e.target.value || null,
                        }
                        setDateRangeFilter(newFilter)
                        
                        // 更新 URL 参数
                        const url = new URL(window.location.href)
                        if (e.target.value) {
                          url.searchParams.set('endDate', e.target.value)
                        } else {
                          url.searchParams.delete('endDate')
                        }
                        url.searchParams.delete('planDate')
                        window.history.replaceState({}, '', url.toString())
                      }}
                      min={dateRangeFilter.startDate || undefined}
                      className="h-9"
                    />
                  </div>
                  
                  {(dateRangeFilter.startDate || dateRangeFilter.endDate) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDateRangeFilter({ startDate: null, endDate: null })
                        
                        // 清除 URL 参数
                        const url = new URL(window.location.href)
                        url.searchParams.delete('startDate')
                        url.searchParams.delete('endDate')
                        url.searchParams.delete('planDate')
                        window.history.replaceState({}, '', url.toString())
                      }}
                      className="h-9 gap-2"
                    >
                      <X className="h-4 w-4" />
                      清除
                    </Button>
                  )}
                </div>
                
                {(dateRangeFilter.startDate || dateRangeFilter.endDate) && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {dateFilterType === 'created' ? '按创建时间' : '按计划时间'}：
                    </span>
                    {' '}
                    {dateRangeFilter.startDate && dateRangeFilter.endDate ? (
                      <span>显示 {new Date(dateRangeFilter.startDate).toLocaleDateString('zh-CN')} 至 {new Date(dateRangeFilter.endDate).toLocaleDateString('zh-CN')} 的学习资料</span>
                    ) : dateRangeFilter.startDate ? (
                      <span>显示 {new Date(dateRangeFilter.startDate).toLocaleDateString('zh-CN')} 之后的学习资料</span>
                    ) : (
                      <span>显示 {new Date(dateRangeFilter.endDate!).toLocaleDateString('zh-CN')} 之前的学习资料</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Materials with Growth Map */}
            {growthMaps.map((map) => {
              // 根据日期范围过滤资料
              let mapMaterials = filteredMaterials.filter(
                (m) => m.mapId === map.id && m.category === 'materials'
              )
              
              // 如果有日期范围过滤，根据选择的类型筛选
              if (dateRangeFilter.startDate || dateRangeFilter.endDate) {
                mapMaterials = mapMaterials.filter(m => {
                  // 根据筛选类型选择日期字段
                  const dateToCompare = dateFilterType === 'plan' && m.planDate
                    ? m.planDate.split('T')[0]
                    : new Date(m.createdAt).toISOString().split('T')[0]
                  
                  const start = dateRangeFilter.startDate
                  const end = dateRangeFilter.endDate
                  
                  if (start && end) {
                    return dateToCompare >= start && dateToCompare <= end
                  } else if (start) {
                    return dateToCompare >= start
                  } else if (end) {
                    return dateToCompare <= end
                  }
                  return true
                })
              }
              
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

                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {getDateDisplay(material)}
                                  </div>
                                  {material.planDate && (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-emerald-700 border border-emerald-200/60 shadow-sm whitespace-nowrap hover:shadow-md transition-shadow">
                                      <Target className="h-3.5 w-3.5" />
                                      {new Date(material.planDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }).replace('/', '月') + '日'}
                                    </span>
                                  )}
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

            {/* Materials without Growth Map and Folder */}
            {(() => {
              // 只显示既没有 mapId 也没有 folderId 的资料
              let unmappedMaterials = filteredMaterials.filter(
                (m) => !m.mapId && !m.folderId && m.category === 'materials'
              )
              
              // 应用日期范围过滤
              if (dateRangeFilter.startDate || dateRangeFilter.endDate) {
                unmappedMaterials = unmappedMaterials.filter(m => {
                  // 根据筛选类型选择日期字段
                  const dateToCompare = dateFilterType === 'plan' && m.planDate
                    ? m.planDate.split('T')[0]
                    : new Date(m.createdAt).toISOString().split('T')[0]
                  
                  const start = dateRangeFilter.startDate
                  const end = dateRangeFilter.endDate
                  
                  if (start && end) {
                    return dateToCompare >= start && dateToCompare <= end
                  } else if (start) {
                    return dateToCompare >= start
                  } else if (end) {
                    return dateToCompare <= end
                  }
                  return true
                })
              }
              
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

                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {getDateDisplay(material)}
                                  </div>
                                  {material.planDate && (
                                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-emerald-700 border border-emerald-200/60 shadow-sm whitespace-nowrap hover:shadow-md transition-shadow">
                                      <Target className="h-3.5 w-3.5" />
                                      {new Date(material.planDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }).replace('/', '月') + '日'}
                                    </span>
                                  )}
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
        ) : filteredMaterials.length === 0 ? (
          // Empty State for Grid and Growth Map views
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
                      <div className="flex flex-col gap-1 items-end">
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

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {getDateDisplay(material)}
                      </div>
                      {material.planDate && (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-emerald-700 border border-emerald-200/60 shadow-sm whitespace-nowrap hover:shadow-md transition-shadow">
                          <Target className="h-3.5 w-3.5" />
                          {new Date(material.planDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }).replace('/', '月') + '日'}
                        </span>
                      )}
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

        {/* Batch Upload Dialog */}
        <BatchUploadDialog
          open={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          onSuccess={() => {
            loadMaterials()
            loadFolders()
          }}
          folders={folders.flatMap(function flattenFolders(folder): Array<{ id: string; name: string }> {
            return [
              { id: folder.id, name: folder.name },
              ...folder.children.flatMap(flattenFolders)
            ]
          })}
          defaultFolderId={selectedFolderId || undefined}
        />
      </div>
    </div>
  )
}

export default function MaterialsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">加载中...</div>}>
      <MaterialsPageContent />
    </Suspense>
  )
}
