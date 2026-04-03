'use client'

import { useState, useMemo } from 'react'
import { Calendar, Clock, BookOpen, Edit2, Save, X, CalendarClock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DailyScheduleItem {
  date: string
  dayOfWeek: number
  tasks: Array<{
    taskId: string
    taskTitle: string
    // 旧格式字段（向后兼容）
    learningContent?: string
    estimatedMinutes?: number
    materials?: string[]
    // 新格式字段（元数据模式）
    learningObjectives?: string[]
    difficulty?: 'beginner' | 'intermediate' | 'advanced'
    suggestedDuration?: string
    prerequisites?: string[]
    focusAreas?: string[]
  }>
}

interface SchedulePreferences {
  studyReminderTime: string
  reportReminderTime: string
  summaryTime: string
  weeklyReportDay: number
  monthlyReportDay: number
  timezone: string
}

interface LearningScheduleViewProps {
  mapId: string
  mapStatus: string
  schedule: {
    dailySchedule: DailyScheduleItem[]
    generatedAt: string
  } | null
  preferences: SchedulePreferences | null
  onUpdate?: () => void
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function LearningScheduleView({ 
  mapId,
  mapStatus,
  schedule, 
  preferences: initialPreferences,
  onUpdate 
}: LearningScheduleViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [jumpToPage, setJumpToPage] = useState('')
  
  // 日期范围搜索
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  // 分页大小设置
  const [pageSize, setPageSize] = useState(7)
  const PAGE_SIZE_OPTIONS = [7, 14, 30, 60]
  
  // 根据日期范围过滤学习计划
  const filteredSchedule = useMemo(() => {
    if (!schedule?.dailySchedule) return []
    
    if (!isSearching || (!startDate && !endDate)) {
      return schedule.dailySchedule
    }
    
    return schedule.dailySchedule.filter(day => {
      const dayDate = new Date(day.date)
      const start = startDate ? new Date(startDate) : null
      const end = endDate ? new Date(endDate) : null
      
      if (start && end) {
        return dayDate >= start && dayDate <= end
      } else if (start) {
        return dayDate >= start
      } else if (end) {
        return dayDate <= end
      }
      return true
    })
  }, [schedule?.dailySchedule, isSearching, startDate, endDate])
  
  const totalDays = filteredSchedule.length
  const totalPages = Math.ceil(totalDays / pageSize)
  
  // 当改变分页大小时，调整当前页码以保持大致位置
  const handlePageSizeChange = (newSize: number) => {
    const currentFirstItem = (currentPage - 1) * pageSize
    const newPage = Math.floor(currentFirstItem / newSize) + 1
    setPageSize(newSize)
    setCurrentPage(Math.min(newPage, Math.ceil(totalDays / newSize)))
  }
  
  // 重置搜索时回到第一页
  const handleSearch = () => {
    setIsSearching(true)
    setCurrentPage(1)
  }
  
  const handleResetSearch = () => {
    setStartDate('')
    setEndDate('')
    setIsSearching(false)
    setCurrentPage(1)
  }
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [preferences, setPreferences] = useState<SchedulePreferences>(
    initialPreferences || {
      studyReminderTime: '09:00',
      reportReminderTime: '21:00',
      summaryTime: '23:30',
      weeklyReportDay: 0,
      monthlyReportDay: 1,
      timezone: 'Asia/Shanghai',
    }
  )

  const handleGenerateSchedule = () => {
    // 跳转到 mentor chat，创建新会话并引用地图
    const params = new URLSearchParams({
      mapId: mapId,
      message: '请为这个成长地图生成学习计划',
    })
    window.location.href = `/mentor?${params.toString()}`
  }

  const handleGenerateLesson = (day: DailyScheduleItem) => {
    // 跳转到 advisor chat，创建新会话并引用该天的学习计划
    const params = new URLSearchParams({
      scheduleDate: day.date,
      mapId: mapId,
      message: `请为 ${day.date} 的学习任务生成详细的学习资料`,
    })
    window.location.href = `/advisor?${params.toString()}`
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/growth-map/${mapId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })

      if (response.ok) {
        setIsEditing(false)
        onUpdate?.()
      } else {
        alert('保存失败')
      }
    } catch (error) {
      console.error('Save schedule error:', error)
      alert('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (!schedule) {
    return (
      <div className="space-y-6">
        {/* 学习计划设置 */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5" />
            学习计划设置
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="studyTime">每日学习提醒时间</Label>
              <Input
                id="studyTime"
                type="time"
                value={preferences.studyReminderTime}
                onChange={(e) =>
                  setPreferences({ ...preferences, studyReminderTime: e.target.value })
                }
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                每天这个时间提醒你学习，并生成学习资料和练习题
              </p>
            </div>

            <div>
              <Label htmlFor="reportTime">每日日报提醒时间</Label>
              <Input
                id="reportTime"
                type="time"
                value={preferences.reportReminderTime}
                onChange={(e) =>
                  setPreferences({ ...preferences, reportReminderTime: e.target.value })
                }
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                每天这个时间提醒你写学习日报
              </p>
            </div>

            <div>
              <Label htmlFor="summaryTime">每日自动总结时间</Label>
              <Input
                id="summaryTime"
                type="time"
                value={preferences.summaryTime}
                onChange={(e) =>
                  setPreferences({ ...preferences, summaryTime: e.target.value })
                }
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                每天这个时间自动分析学习进度，生成总结
              </p>
            </div>

            <div>
              <Label htmlFor="weeklyDay">每周周报生成日</Label>
              <select
                id="weeklyDay"
                value={preferences.weeklyReportDay}
                onChange={(e) =>
                  setPreferences({ ...preferences, weeklyReportDay: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {WEEKDAY_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                每周这一天生成学习周报
              </p>
            </div>
          </div>
        </div>

        {/* 暂无学习计划提示 */}
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <CalendarClock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">暂无学习计划</h3>
          <p className="text-xs text-muted-foreground mb-2">当前地图状态：{mapStatus}</p>
          
          {mapStatus === 'draft' && (
            <p className="text-sm text-muted-foreground mb-4">
              请先在对话页面点击"接受地图"按钮
            </p>
          )}
          
          {mapStatus === 'pending_plan' && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                地图已接受，可以开始生成学习计划了
              </p>
              <Button
                onClick={handleGenerateSchedule}
                disabled={isGenerating}
                className="gap-2"
              >
                <CalendarClock className="h-4 w-4" />
                {isGenerating ? '生成中...' : '生成学习计划'}
              </Button>
            </>
          )}
          
          {(mapStatus === 'planned' || mapStatus === 'active') && (
            <p className="text-sm text-muted-foreground">
              学习计划加载中...
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 学习计划设置 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            学习计划设置
          </h2>
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="gap-2"
            >
              <Edit2 className="h-4 w-4" />
              编辑
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false)
                  setPreferences(initialPreferences || preferences)
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="studyTime">每日学习提醒时间</Label>
            <Input
              id="studyTime"
              type="time"
              value={preferences.studyReminderTime}
              onChange={(e) =>
                setPreferences({ ...preferences, studyReminderTime: e.target.value })
              }
              disabled={!isEditing}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              每天这个时间提醒你学习，并生成学习资料和练习题
            </p>
          </div>

          <div>
            <Label htmlFor="reportTime">每日日报提醒时间</Label>
            <Input
              id="reportTime"
              type="time"
              value={preferences.reportReminderTime}
              onChange={(e) =>
                setPreferences({ ...preferences, reportReminderTime: e.target.value })
              }
              disabled={!isEditing}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              每天这个时间提醒你写学习日报
            </p>
          </div>

          <div>
            <Label htmlFor="summaryTime">每日自动总结时间</Label>
            <Input
              id="summaryTime"
              type="time"
              value={preferences.summaryTime}
              onChange={(e) =>
                setPreferences({ ...preferences, summaryTime: e.target.value })
              }
              disabled={!isEditing}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              每天这个时间自动分析学习进度，生成总结
            </p>
          </div>

          <div>
            <Label htmlFor="weeklyDay">每周周报生成日</Label>
            <select
              id="weeklyDay"
              value={preferences.weeklyReportDay}
              onChange={(e) =>
                setPreferences({ ...preferences, weeklyReportDay: Number(e.target.value) })
              }
              disabled={!isEditing}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {WEEKDAY_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>
                  {name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              每周这一天生成学习周报
            </p>
          </div>
        </div>
      </div>

      {/* 每日学习计划 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5" />
          每日学习计划
        </h2>

        {/* 日期范围搜索 */}
        <div className="mb-4 p-4 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="start-date" className="text-sm mb-1.5 block">
                开始日期
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
            
            <div className="flex-1 min-w-[150px]">
              <Label htmlFor="end-date" className="text-sm mb-1.5 block">
                结束日期
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="h-9"
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSearch}
                disabled={!startDate && !endDate}
                className="h-9"
              >
                <Search className="h-4 w-4 mr-1" />
                搜索
              </Button>
              
              {isSearching && (startDate || endDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetSearch}
                  className="h-9"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  重置
                </Button>
              )}
            </div>
          </div>
          
          {isSearching && (startDate || endDate) && (
            <div className="mt-3 text-sm text-muted-foreground">
              {startDate && endDate ? (
                <span>显示 {new Date(startDate).toLocaleDateString('zh-CN')} 至 {new Date(endDate).toLocaleDateString('zh-CN')} 的学习计划</span>
              ) : startDate ? (
                <span>显示 {new Date(startDate).toLocaleDateString('zh-CN')} 之后的学习计划</span>
              ) : (
                <span>显示 {new Date(endDate).toLocaleDateString('zh-CN')} 之前的学习计划</span>
              )}
            </div>
          )}
        </div>

        {/* 无结果提示 */}
        {filteredSchedule.length === 0 && isSearching ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-2">未找到符合条件的学习计划</p>
            <p className="text-sm text-muted-foreground mb-4">
              请尝试调整日期范围
            </p>
            <Button variant="outline" size="sm" onClick={handleResetSearch}>
              <RotateCcw className="h-4 w-4 mr-1" />
              重置搜索
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSchedule
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((day, idx) => {
            const date = new Date(day.date)
            const isToday = new Date().toDateString() === date.toDateString()
                  const totalMinutes = day.tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0)

            return (
              <div
                key={day.date}
                className={`rounded-lg border p-4 transition-all ${
                  isToday
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {date.getDate()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {WEEKDAY_NAMES[day.dayOfWeek]}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">
                        {day.date}
                        {isToday && (
                          <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                            今天
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {day.tasks.length} 个任务 · 约 {totalMinutes} 分钟
                      </div>
                    </div>
                  </div>
                  
                  {/* 生成学习资料按钮 */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateLesson(day)}
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    生成学习资料
                  </Button>
                </div>

                <div className="space-y-3">
                  {day.tasks.map((task, taskIdx) => (
                    <div
                      key={taskIdx}
                      className="pl-4 border-l-2 border-primary/30"
                    >
                      <div className="font-medium text-sm mb-1">
                        {task.taskTitle}
                      </div>
                      
                      {/* 兼容新旧两种格式 */}
                      {/* 旧格式：learningContent */}
                      {task.learningContent && (
                        <div className="text-sm text-muted-foreground mb-2">
                          {task.learningContent}
                        </div>
                      )}
                      
                      {/* 新格式：learningObjectives */}
                      {task.learningObjectives && task.learningObjectives.length > 0 && (
                        <div className="text-sm text-muted-foreground mb-2">
                          <div className="font-medium text-xs mb-1">学习目标：</div>
                          <ul className="list-disc list-inside space-y-0.5">
                            {task.learningObjectives.map((obj, idx) => (
                              <li key={idx}>{obj}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* 旧格式：materials */}
                      {task.materials && task.materials.length > 0 && (
                        <div className="text-xs text-muted-foreground mb-1">
                          学习要点：{task.materials.join(' · ')}
                        </div>
                      )}
                      
                      {/* 新格式：focusAreas */}
                      {task.focusAreas && task.focusAreas.length > 0 && (
                        <div className="text-xs text-muted-foreground mb-1">
                          重点领域：{task.focusAreas.join(' · ')}
                        </div>
                      )}
                      
                      {/* 新格式：difficulty */}
                      {task.difficulty && (
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full mr-2 ${
                          task.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                          task.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {task.difficulty === 'beginner' ? '入门' :
                           task.difficulty === 'intermediate' ? '中级' : '高级'}
                        </span>
                      )}
                      
                      {/* 旧格式：estimatedMinutes */}
                      {task.estimatedMinutes && (
                        <span className="text-xs text-muted-foreground">
                          预计 {task.estimatedMinutes} 分钟
                        </span>
                      )}
                      
                      {/* 新格式：suggestedDuration */}
                      {task.suggestedDuration && !task.estimatedMinutes && (
                        <span className="text-xs text-muted-foreground">
                          建议时长：{task.suggestedDuration}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
            })}
          </div>
        )}

        {/* 翻页控件（移到尾部） */}
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* 左侧：分页大小和统计信息 */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="page-size" className="text-sm text-muted-foreground whitespace-nowrap">
                    每页
                  </Label>
                  <select
                    id="page-size"
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="h-8 px-2 text-sm border border-border rounded-md bg-background"
                  >
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <option key={size} value={size}>
                        {size} 天
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {isSearching && (startDate || endDate) ? (
                    <span className="text-primary">
                      搜索结果：{totalDays} 天
                    </span>
                  ) : (
                    <span>共 {totalDays} 天</span>
                  )}
                </div>
              </div>

              {/* 中间：页面导航按钮 */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  title="第一页"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  title="上一页"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-sm text-muted-foreground px-2">
                  第 {currentPage} / {totalPages} 页
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  title="下一页"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="最后一页"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              {/* 右侧：跳转到指定页 */}
              <div className="flex items-center gap-2">
                <Label htmlFor="jump-to-page" className="text-sm text-muted-foreground whitespace-nowrap">
                  跳转到
                </Label>
                <Input
                  id="jump-to-page"
                  type="number"
                  min="1"
                  max={totalPages}
                  value={jumpToPage}
                  onChange={(e) => setJumpToPage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const page = parseInt(jumpToPage)
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page)
                        setJumpToPage('')
                      }
                    }
                  }}
                  placeholder={`1-${totalPages}`}
                  className="w-20 h-8"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const page = parseInt(jumpToPage)
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page)
                      setJumpToPage('')
                    }
                  }}
                  disabled={!jumpToPage || parseInt(jumpToPage) < 1 || parseInt(jumpToPage) > totalPages}
                >
                  跳转
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-muted-foreground text-center">
          计划生成时间：{new Date(schedule.generatedAt).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  )
}
