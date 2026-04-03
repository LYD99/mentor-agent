'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Home, Edit, Calendar, Eye, ClipboardList, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GrowthMapTree } from '../chat/growth-map-tree'
import { GrowthMapGantt } from './growth-map-gantt'
import { GrowthMapEditor } from './growth-map-editor'
import { LearningScheduleView } from './learning-schedule-view'
import { cn } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'

type ViewMode = 'view' | 'edit' | 'gantt' | 'schedule'

interface GrowthMapDetailProps {
  data: {
    mapId: string
    title: string
    description: string
    status: string
    createdAt: string
    updatedAt: string
    learningPlan?: {
      dailySchedule: Array<{
        date: string
        dayOfWeek: number
        tasks: Array<{
          taskId: string
          taskTitle: string
          learningContent: string
          estimatedMinutes: number
          materials: string[]
        }>
      }>
      generatedAt: string
    } | null
    schedulePreferences?: {
      studyReminderTime: string
      reportReminderTime: string
      summaryTime: string
      weeklyReportDay: number
      monthlyReportDay: number
      timezone: string
    } | null
    stages: Array<{
      id: string
      title: string
      description: string
      durationWeeks: number
      goals: Array<{
        id: string
        title: string
        description: string
        tasks: Array<{
          id: string
          title: string
          description: string
          type: 'learn' | 'practice' | 'test' | 'reflect'
          durationDays: number
          status: 'pending' | 'in_progress' | 'completed'
        }>
      }>
    }>
  }
}

export function GrowthMapDetail({ data }: GrowthMapDetailProps) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') as ViewMode | null
  const [viewMode, setViewMode] = useState<ViewMode>(initialTab || 'view')
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  // 监听 URL 参数变化
  useEffect(() => {
    const tab = searchParams.get('tab') as ViewMode | null
    if (tab && ['view', 'edit', 'gantt', 'schedule'].includes(tab)) {
      setViewMode(tab)
    }
  }, [searchParams])

  const handleTaskStatusChange = async (taskId: string, status: 'pending' | 'in_progress' | 'completed') => {
    try {
      const response = await fetch(`/api/growth-map/task/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        alert('更新状态失败')
      }
    } catch (error) {
      console.error('Update status error:', error)
      alert('更新状态失败')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`确定要删除成长地图「${data.title}」吗？\n\n此操作将删除所有关联的学习计划、学习资料和报告，且无法恢复。`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/growth-map/${data.mapId}/delete`, {
        method: 'DELETE',
      })

      if (response.ok) {
        alert('成长地图已删除')
        router.push('/growth')
      } else {
        const result = await response.json()
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete map error:', error)
      alert('删除失败')
    } finally {
      setIsDeleting(false)
    }
  }

  // 计算进度统计
  const totalTasks = data.stages.reduce((sum, stage) => 
    sum + stage.goals.reduce((gSum, goal) => gSum + goal.tasks.length, 0), 0
  )
  const completedTasks = data.stages.reduce((sum, stage) => 
    sum + stage.goals.reduce((gSum, goal) => 
      gSum + goal.tasks.filter(t => t.status === 'completed').length, 0
    ), 0
  )
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-7xl p-4 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">
                首页
              </Link>
              <span aria-hidden>/</span>
              <Link href="/growth" className="hover:text-foreground transition-colors">
                成长地图
              </Link>
              <span aria-hidden>/</span>
              <span>详情</span>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{isDeleting ? '删除中...' : '删除地图'}</span>
              </Button>
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">返回首页</span>
                </Button>
              </Link>
            </div>
          </div>

          <div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              {data.title}
            </h1>
            <p className="text-muted-foreground mb-3">
              {data.description}
            </p>
            {/* 进度条 */}
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-md">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {completedTasks} / {totalTasks} 任务 · {progressPercentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge & View Mode Tabs */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setViewMode('view')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
                viewMode === 'view'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="h-4 w-4" />
              查看
            </button>
            <button
              onClick={() => setViewMode('schedule')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
                viewMode === 'schedule'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <ClipboardList className="h-4 w-4" />
              学习计划
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
                viewMode === 'gantt'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Calendar className="h-4 w-4" />
              甘特图
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
                viewMode === 'edit'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Edit className="h-4 w-4" />
              编辑
            </button>
          </div>

          {data.status === 'draft' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              此地图为草稿状态，请在编辑模式中保存并激活
            </div>
          )}
          {data.status === 'pending_plan' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
              地图已接受，点击右上角"生成学习计划"按钮创建详细的学习安排
            </div>
          )}
          {data.status === 'planned' && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
              学习计划已生成，点击右上角"开始学习"按钮激活地图
            </div>
          )}
        </div>

        {/* Content */}
        {viewMode === 'view' && (
          <div>
            <GrowthMapTree 
              data={data} 
              defaultExpandAll={true} 
              showProgress={true}
              onTaskStatusChange={handleTaskStatusChange}
            />
            
            {/* Additional Info */}
            <div className="mt-6 rounded-lg border border-border bg-card p-4">
              <h2 className="font-semibold text-sm mb-2">地图信息</h2>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>状态：{
                  data.status === 'draft' ? '草稿' : 
                  data.status === 'pending_plan' ? '待规划' : 
                  data.status === 'planned' ? '已规划' : 
                  data.status === 'learning' ? '学习中' : 
                  '已完成'
                }</p>
                <p>进度：{completedTasks} / {totalTasks} 任务已完成 ({progressPercentage}%)</p>
                <p>创建时间：{new Date(data.createdAt).toLocaleDateString('zh-CN')}</p>
                <p>最后更新：{new Date(data.updatedAt).toLocaleDateString('zh-CN')}</p>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'schedule' && (
          <LearningScheduleView
            mapId={data.mapId}
            mapStatus={data.status}
            schedule={data.learningPlan || null}
            preferences={data.schedulePreferences || null}
            onUpdate={() => router.refresh()}
          />
        )}

        {viewMode === 'gantt' && (
          <GrowthMapGantt data={data} />
        )}

        {viewMode === 'edit' && (
          <GrowthMapEditor data={data} />
        )}
      </div>
    </div>
  )
}
