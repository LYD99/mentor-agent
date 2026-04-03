'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Calendar, X, Check, ChevronDown, ChevronRight, ChevronLeft, Search, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type ResourceType = 'lesson' | 'schedule'

type LessonResource = {
  type: 'lesson'
  id: string
  title: string
  taskTitle?: string
  date?: string
}

type ScheduleResource = {
  type: 'schedule'
  mapId: string
  mapTitle: string
  totalDays: number
  totalTasks: number
  scheduleDate?: string // 可选：具体某天的日期
  dayTasks?: Array<{   // 可选：该天的任务列表
    taskTitle: string
    learningObjectives?: string[]
    estimatedMinutes?: number
  }>
}

type Resource = LessonResource | ScheduleResource

type LearningResourceSelectorProps = {
  selectedResource?: Resource
  onSelect: (resource: Resource | undefined) => void
  disabled?: boolean
}

type ScheduleWithDays = ScheduleResource & {
  dailySchedule?: Array<{
    date: string
    dayOfWeek: number
    tasks: Array<{
      taskTitle: string
      learningObjectives?: string[]
      estimatedMinutes?: number
    }>
  }>
}

export function LearningResourceSelector({
  selectedResource,
  onSelect,
  disabled = false,
}: LearningResourceSelectorProps) {
  const [open, setOpen] = useState(false)
  const [lessons, setLessons] = useState<LessonResource[]>([])
  const [schedules, setSchedules] = useState<ScheduleWithDays[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<ResourceType>('lesson')
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null)
  
  // 日期范围搜索
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  // 分页
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 7 // 每页显示7天

  useEffect(() => {
    if (open && lessons.length === 0 && schedules.length === 0) {
      loadResources()
    }
  }, [open])

  const loadResources = async () => {
    setLoading(true)
    try {
      // 加载学习资料（最近的讲义）
      const lessonsRes = await fetch('/api/lesson/recent', {
        credentials: 'include',
      })
      if (lessonsRes.ok) {
        const data = await lessonsRes.json()
        setLessons(data.lessons || [])
      }

      // 加载学习计划（有计划的成长地图）
      const schedulesRes = await fetch('/api/growth-map/list', {
        credentials: 'include',
      })
      if (schedulesRes.ok) {
        const data = await schedulesRes.json()
        const scheduleMaps = (data.maps || [])
          .filter((m: any) => (m.status === 'planned' || m.status === 'learning') && m.scheduleDays > 0)
          .map((m: any) => {
            // 解析学习计划 JSON 获取每日计划
            let dailySchedule: any[] | undefined
            if (m.learningPlanJson) {
              try {
                const plan = JSON.parse(m.learningPlanJson)
                dailySchedule = plan.dailySchedule
              } catch (e) {
                console.error('[LearningResourceSelector] Failed to parse learningPlanJson:', e)
              }
            }

            return {
              type: 'schedule' as const,
              mapId: m.id,
              mapTitle: m.title,
              totalDays: m.scheduleDays || 0,
              totalTasks: m.scheduleTasks || 0,
              dailySchedule,
            }
          })
        console.log('[LearningResourceSelector] Final schedules:', scheduleMaps)
        setSchedules(scheduleMaps)
      }
    } catch (err) {
      console.error('Failed to load resources:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (resource: Resource, keepOpen = false) => {
    onSelect(resource)
    if (!keepOpen) {
      setOpen(false)
    }
  }

  const handleClear = () => {
    onSelect(undefined)
    setOpen(false)
  }

  // 日期范围搜索
  const handleSearch = () => {
    setIsSearching(true)
    setCurrentPage(1) // 重置到第一页
  }

  const handleResetSearch = () => {
    setStartDate('')
    setEndDate('')
    setIsSearching(false)
    setCurrentPage(1)
  }

  // 过滤每日计划
  const getFilteredDays = (schedule: ScheduleWithDays) => {
    if (!schedule.dailySchedule) return []
    
    let filtered = schedule.dailySchedule
    
    // 日期范围过滤
    if (isSearching && (startDate || endDate)) {
      filtered = filtered.filter(day => {
        if (startDate && day.date < startDate) return false
        if (endDate && day.date > endDate) return false
        return true
      })
    }
    
    return filtered
  }

  // 获取分页后的天数
  const getPaginatedDays = (days: any[]) => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return days.slice(start, end)
  }

  // 计算总页数
  const getTotalPages = (totalDays: number) => {
    return Math.ceil(totalDays / pageSize)
  }

  const getResourceDisplay = () => {
    if (!selectedResource) return null
    
    if (selectedResource.type === 'lesson') {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-primary">{selectedResource.title}</span>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-primary/60 hover:text-primary disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
    
    if (selectedResource.type === 'schedule') {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-1.5 text-xs">
          <Calendar className="h-3.5 w-3.5 text-emerald-600" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-emerald-700">{selectedResource.mapTitle}</span>
            {selectedResource.scheduleDate && (
              <span className="text-emerald-600/80 text-[10px]">
                📅 {selectedResource.scheduleDate} · {selectedResource.dayTasks?.length || 0} 个任务
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-emerald-600/60 hover:text-emerald-600 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  }

  return (
    <div className="flex items-center gap-2">
      {getResourceDisplay()}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "gap-2 text-muted-foreground hover:text-foreground",
              selectedResource && "text-primary hover:text-primary"
            )}
          >
            <BookOpen className="h-4 w-4" />
            {selectedResource ? '更换资源' : '@ 学习资源'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-3" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">选择学习资源</h4>
              {selectedResource && (
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

            {/* Tab 切换 */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('lesson')}
                className={cn(
                  'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                  activeTab === 'lesson'
                    ? 'bg-background text-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                学习资料
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className={cn(
                  'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                  activeTab === 'schedule'
                    ? 'bg-background text-foreground font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                学习计划
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                加载中...
              </div>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {activeTab === 'lesson' && (
                  lessons.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      暂无学习资料
                    </div>
                  ) : (
                    lessons.map((lesson) => {
                      const isSelected = selectedResource?.type === 'lesson' && selectedResource.id === lesson.id
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => handleSelect(lesson)}
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
                                <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <p className="text-sm font-medium truncate">
                                  {lesson.title}
                                </p>
                                {isSelected && (
                                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                )}
                              </div>
                              {lesson.taskTitle && (
                                <p className="text-xs text-muted-foreground mt-1 ml-6">
                                  {lesson.taskTitle}
                                </p>
                              )}
                              {lesson.date && (
                                <p className="text-xs text-muted-foreground mt-1 ml-6">
                                  {lesson.date}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })
                  )
                )}

                {activeTab === 'schedule' && (
                  schedules.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      暂无学习计划
                      <p className="mt-2 text-xs">
                        先在 Mentor 中生成学习计划
                      </p>
                    </div>
                  ) : (
                    schedules.map((schedule) => {
                      const isWholeScheduleSelected = 
                        selectedResource?.type === 'schedule' && 
                        selectedResource.mapId === schedule.mapId &&
                        !selectedResource.scheduleDate
                      const isExpanded = expandedScheduleId === schedule.mapId
                      const hasDailySchedule = schedule.dailySchedule && schedule.dailySchedule.length > 0
                      
                      return (
                        <div key={schedule.mapId} className="space-y-1">
                          {/* 整个学习计划 */}
                          <div className="flex items-stretch gap-1">
                            <button
                              type="button"
                              onClick={() => handleSelect({
                                type: 'schedule',
                                mapId: schedule.mapId,
                                mapTitle: schedule.mapTitle,
                                totalDays: schedule.totalDays,
                                totalTasks: schedule.totalTasks,
                              })}
                              className={cn(
                                'flex-1 rounded-lg border p-3 text-left transition-all',
                                isWholeScheduleSelected
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : 'border-border hover:border-emerald-500/50 hover:bg-muted/50'
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                                    <p className="text-sm font-medium truncate">
                                      {schedule.mapTitle}
                                    </p>
                                    {isWholeScheduleSelected && (
                                      <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 ml-6 text-xs text-muted-foreground">
                                    <span>{schedule.totalDays} 天</span>
                                    <span>{schedule.totalTasks} 个任务</span>
                                  </div>
                                </div>
                              </div>
                            </button>
                            
                            {/* 展开/折叠按钮 */}
                            {hasDailySchedule && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  
                                  if (!isExpanded) {
                                    // 展开时，自动选择今天的学习计划
                                    const today = new Date().toISOString().split('T')[0]
                                    const todaySchedule = schedule.dailySchedule?.find(d => d.date === today)
                                    
                                    setExpandedScheduleId(schedule.mapId)
                                    
                                    if (todaySchedule) {
                                      // 找到今天的计划，自动选择（但不关闭弹窗）
                                      handleSelect({
                                        type: 'schedule',
                                        mapId: schedule.mapId,
                                        mapTitle: schedule.mapTitle,
                                        totalDays: schedule.totalDays,
                                        totalTasks: schedule.totalTasks,
                                        scheduleDate: todaySchedule.date,
                                        dayTasks: todaySchedule.tasks,
                                      }, true) // keepOpen = true
                                      
                                      // 计算今天在第几页
                                      const todayIndex = schedule.dailySchedule?.findIndex(d => d.date === today) || 0
                                      const todayPage = Math.floor(todayIndex / pageSize) + 1
                                      setCurrentPage(todayPage)
                                    }
                                  } else {
                                    setExpandedScheduleId(null)
                                  }
                                }}
                                className="px-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                            )}
                          </div>
                          
                          {/* 每日计划列表 */}
                          {isExpanded && hasDailySchedule && (() => {
                            const filteredDays = getFilteredDays(schedule)
                            const paginatedDays = getPaginatedDays(filteredDays)
                            const totalPages = getTotalPages(filteredDays.length)
                            
                            return (
                              <div className="ml-4 space-y-2 border-l-2 border-emerald-200 pl-2">
                                {/* 日期范围搜索 */}
                                <div className="p-2 rounded-md bg-muted/30 space-y-2">
                                  <div className="flex items-end gap-2">
                                    <div className="flex-1 min-w-0">
                                      <Label htmlFor={`start-${schedule.mapId}`} className="text-[10px] mb-0.5 block">
                                        开始日期
                                      </Label>
                                      <Input
                                        id={`start-${schedule.mapId}`}
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <Label htmlFor={`end-${schedule.mapId}`} className="text-[10px] mb-0.5 block">
                                        结束日期
                                      </Label>
                                      <Input
                                        id={`end-${schedule.mapId}`}
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={startDate || undefined}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      type="button"
                                      variant="default"
                                      size="sm"
                                      onClick={handleSearch}
                                      disabled={!startDate && !endDate}
                                      className="h-6 text-xs flex-1"
                                    >
                                      <Search className="h-3 w-3 mr-1" />
                                      搜索
                                    </Button>
                                    {isSearching && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleResetSearch}
                                        className="h-6 text-xs"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* 每日计划列表 */}
                                {filteredDays.length === 0 ? (
                                  <div className="text-xs text-muted-foreground text-center py-4">
                                    未找到符合条件的日期
                                  </div>
                                ) : (
                                  <>
                                    <div className="space-y-1">
                                      {paginatedDays.map((day) => {
                                        const isDaySelected = 
                                          selectedResource?.type === 'schedule' && 
                                          selectedResource.mapId === schedule.mapId &&
                                          selectedResource.scheduleDate === day.date
                                        
                                        return (
                                          <button
                                            key={day.date}
                                            type="button"
                                            onClick={() => handleSelect({
                                              type: 'schedule',
                                              mapId: schedule.mapId,
                                              mapTitle: schedule.mapTitle,
                                              totalDays: schedule.totalDays,
                                              totalTasks: schedule.totalTasks,
                                              scheduleDate: day.date,
                                              dayTasks: day.tasks,
                                            })}
                                            className={cn(
                                              'w-full rounded-md border p-2 text-left transition-all text-xs',
                                              isDaySelected
                                                ? 'border-emerald-500 bg-emerald-50'
                                                : 'border-border hover:border-emerald-500/50 hover:bg-muted/30'
                                            )}
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-medium">{day.date}</span>
                                                  <span className="text-muted-foreground">
                                                    {day.tasks.length} 个任务
                                                  </span>
                                                </div>
                                                {/* 显示任务名称 */}
                                                <div className="text-[10px] text-muted-foreground space-y-0.5">
                                                  {day.tasks.slice(0, 3).map((task: any, idx: number) => (
                                                    <div key={idx} className="truncate">
                                                      • {task.taskTitle}
                                                    </div>
                                                  ))}
                                                  {day.tasks.length > 3 && (
                                                    <div className="text-muted-foreground/60">
                                                      还有 {day.tasks.length - 3} 个任务...
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              {isDaySelected && (
                                                <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                                              )}
                                            </div>
                                          </button>
                                        )
                                      })}
                                    </div>

                                    {/* 分页控件 */}
                                    {totalPages > 1 && (
                                      <div className="flex items-center justify-between pt-2 border-t border-border">
                                        <div className="text-xs text-muted-foreground">
                                          第 {currentPage} / {totalPages} 页 · 共 {filteredDays.length} 天
                                        </div>
                                        <div className="flex gap-1">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="h-6 w-6 p-0"
                                          >
                                            <ChevronLeft className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="h-6 w-6 p-0"
                                          >
                                            <ChevronRight className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })
                  )
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
