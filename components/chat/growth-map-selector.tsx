'use client'

import { useState, useEffect } from 'react'
import { Map, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type GrowthMapItem = {
  id: string
  title: string
  description: string | null
  status: string
  stageCount: number
  taskCount: number
}

type GrowthMapSelectorProps = {
  selectedMapId?: string
  onSelect: (mapId: string | undefined) => void
  disabled?: boolean
}

export function GrowthMapSelector({
  selectedMapId,
  onSelect,
  disabled = false,
}: GrowthMapSelectorProps) {
  const [open, setOpen] = useState(false)
  const [maps, setMaps] = useState<GrowthMapItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMap, setSelectedMap] = useState<GrowthMapItem | null>(null)

  useEffect(() => {
    if (open && maps.length === 0) {
      loadMaps()
    }
  }, [open])

  // 如果有 selectedMapId 但 maps 为空，主动加载地图列表
  useEffect(() => {
    if (selectedMapId && maps.length === 0 && !loading) {
      loadMaps()
    }
  }, [selectedMapId, maps.length, loading])

  useEffect(() => {
    if (selectedMapId && maps.length > 0) {
      const map = maps.find(m => m.id === selectedMapId)
      setSelectedMap(map || null)
    } else {
      setSelectedMap(null)
    }
  }, [selectedMapId, maps])

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
      console.error('Failed to load growth maps:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (mapId: string) => {
    onSelect(mapId)
    setOpen(false)
  }

  const handleClear = () => {
    onSelect(undefined)
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2">
      {selectedMap && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs">
          <Map className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-primary">{selectedMap.title}</span>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-primary/60 hover:text-primary disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "gap-2 text-muted-foreground hover:text-foreground",
              selectedMap && "text-primary hover:text-primary"
            )}
          >
            <Map className="h-4 w-4" />
            {selectedMap ? '更换地图' : '@ 成长地图'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">选择成长地图</h4>
              {selectedMap && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 text-xs"
                >
                  清除
                </Button>
              )}
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                加载中...
              </div>
            ) : maps.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无成长地图
                <p className="mt-2 text-xs">
                  先在 Mentor 中创建学习计划
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {maps.map((map) => {
                  const isSelected = map.id === selectedMapId
                  return (
                    <button
                      key={map.id}
                      type="button"
                      onClick={() => handleSelect(map.id)}
                      className={cn(
                        'w-full rounded-lg border p-3 text-left transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {map.title}
                            </p>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </div>
                          {map.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {map.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{map.stageCount} 阶段</span>
                            <span>{map.taskCount} 任务</span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full',
                                map.status === 'learning'
                                  ? 'bg-green-100 text-green-700'
                                  : map.status === 'planned'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : map.status === 'pending_plan'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-600'
                              )}
                            >
                              {map.status === 'learning' ? '学习中' : map.status === 'planned' ? '已规划' : map.status === 'pending_plan' ? '待规划' : map.status === 'draft' ? '草稿' : map.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
