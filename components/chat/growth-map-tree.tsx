'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, Clock, ChevronRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

type TaskType = 'learn' | 'practice' | 'test' | 'reflect'

interface Task {
  id?: string
  title: string
  description: string
  type: TaskType
  durationDays: number
  status?: 'pending' | 'in_progress' | 'completed'
}

interface Goal {
  title: string
  description: string
  tasks: Task[]
}

interface Stage {
  title: string
  description: string
  durationWeeks: number
  goals: Goal[]
}

interface GrowthMapData {
  mapId: string
  title: string
  description: string
  stages: Stage[]
  status?: string
}

const taskTypeColors: Record<TaskType, string> = {
  learn: 'bg-blue-500',
  practice: 'bg-green-500',
  test: 'bg-purple-500',
  reflect: 'bg-amber-500',
}

const stageColors = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-purple-500 to-purple-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
]

export function GrowthMapTree({ 
  data, 
  defaultExpandAll = false,
  showProgress = false,
  onTaskStatusChange,
  showApproval = false,
  onApprove,
  showStatus = false,
}: { 
  data: GrowthMapData
  defaultExpandAll?: boolean
  showProgress?: boolean
  onTaskStatusChange?: (taskId: string, status: 'pending' | 'in_progress' | 'completed') => void
  showApproval?: boolean
  onApprove?: () => void
  showStatus?: boolean
}) {
  const [expandedStages, setExpandedStages] = useState<Set<number>>(() => {
    if (defaultExpandAll) {
      return new Set(data.stages.map((_, idx) => idx))
    }
    return new Set([0]) // 默认展开第一个阶段
  })
  
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(() => {
    if (defaultExpandAll) {
      const allGoals = new Set<string>()
      data.stages.forEach((stage, sIdx) => {
        stage.goals.forEach((_, gIdx) => {
          allGoals.add(`${sIdx}-${gIdx}`)
        })
      })
      return allGoals
    }
    return new Set()
  })

  const toggleStage = (idx: number) => {
    const newSet = new Set(expandedStages)
    if (newSet.has(idx)) {
      newSet.delete(idx)
    } else {
      newSet.add(idx)
    }
    setExpandedStages(newSet)
  }

  const toggleGoal = (key: string) => {
    const newSet = new Set(expandedGoals)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedGoals(newSet)
  }

  const totalWeeks = data.stages.reduce((sum, s) => sum + s.durationWeeks, 0)

  return (
    <div className="not-prose my-4 rounded-xl border border-border bg-gradient-to-br from-background to-muted/20 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-primary via-primary/90 to-primary/80 p-6 text-primary-foreground">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-xl font-bold mb-2">
                {data.title}
              </h3>
              <p className="text-sm text-primary-foreground/90 leading-relaxed">
                {data.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-primary-foreground/80">
            <span className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1">
              <Clock className="h-3.5 w-3.5" />
              {totalWeeks} 周
            </span>
            <span className="bg-white/10 rounded-full px-3 py-1">
              {data.stages.length} 个阶段
            </span>
            {/* 地图状态显示 */}
            {showStatus && data.status && (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                data.status === 'draft' ? 'bg-yellow-400 text-yellow-950' :
                data.status === 'pending_plan' ? 'bg-blue-400 text-blue-950' :
                data.status === 'planned' ? 'bg-emerald-400 text-emerald-950' :
                data.status === 'learning' ? 'bg-green-400 text-green-950' :
                'bg-white text-gray-950'
              }`}>
                {data.status === 'draft' ? 'Draft' :
                 data.status === 'pending_plan' ? 'Pending Plan' :
                 data.status === 'planned' ? 'Planned' :
                 data.status === 'learning' ? 'Learning' :
                 data.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tree Structure */}
      <div className="p-6">
        <div className="relative">
          {/* Root node */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
              <span className="text-sm font-bold">开始</span>
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              学习路径
            </div>
          </div>

          {/* Stages */}
          <div className="space-y-4 pl-5 border-l-2 border-dashed border-border">
            {data.stages.map((stage, sIdx) => {
              const isExpanded = expandedStages.has(sIdx)
              const colorClass = stageColors[sIdx % stageColors.length]

              return (
                <div key={sIdx} className="relative">
                  {/* Stage node */}
                  <div className="absolute -left-[1.6rem] top-3 h-5 w-5 rounded-full border-2 border-background bg-gradient-to-br from-muted to-muted-foreground shadow-sm" />
                  
                  <div className="ml-6">
                    <button
                      onClick={() => toggleStage(sIdx)}
                      className="group w-full text-left"
                    >
                      <div className={`rounded-lg bg-gradient-to-r ${colorClass} p-4 shadow-md transition-all hover:shadow-lg hover:scale-[1.02]`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/20 text-xs font-bold text-white">
                                {sIdx + 1}
                              </span>
                              <h4 className="font-semibold text-white">
                                {stage.title}
                              </h4>
                              <span className="text-xs text-white/80">
                                {stage.durationWeeks} 周
                              </span>
                            </div>
                            <p className="text-xs text-white/90 leading-relaxed line-clamp-2">
                              {stage.description}
                            </p>
                          </div>
                          <ChevronRight
                            className={`h-5 w-5 text-white/80 transition-transform flex-shrink-0 ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Goals */}
                    {isExpanded && (
                      <div className="mt-4 space-y-3 pl-4 border-l-2 border-dashed border-muted-foreground/30">
                        {stage.goals.map((goal, gIdx) => {
                          const goalKey = `${sIdx}-${gIdx}`
                          const isGoalExpanded = expandedGoals.has(goalKey)

                          return (
                            <div key={gIdx} className="relative">
                              {/* Goal node */}
                              <div className="absolute -left-[1.1rem] top-2 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground/60" />
                              
                              <div className="ml-4">
                                <button
                                  onClick={() => toggleGoal(goalKey)}
                                  className="group w-full text-left"
                                >
                                  <div className="rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-2 flex-1 min-w-0">
                                        <Circle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-foreground">
                                            {goal.title}
                                          </p>
                                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                            {goal.description}
                                          </p>
                                        </div>
                                      </div>
                                      {goal.tasks.length > 0 && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-muted-foreground">
                                            {goal.tasks.length}
                                          </span>
                                          <ChevronRight
                                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                                              isGoalExpanded ? 'rotate-90' : ''
                                            }`}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </button>

                                {/* Tasks */}
                                {isGoalExpanded && goal.tasks.length > 0 && (
                                  <div className="mt-2 space-y-1.5 pl-4 border-l border-dashed border-muted-foreground/20">
                                    {goal.tasks.map((task, tIdx) => {
                                      const isCompleted = task.status === 'completed'
                                      const isInProgress = task.status === 'in_progress'
                                      
                                      return (
                                        <div
                                          key={task.id || tIdx}
                                          className="flex items-start gap-2 group"
                                        >
                                          {showProgress && task.id ? (
                                            <button
                                              onClick={() => {
                                                const newStatus = isCompleted ? 'pending' : isInProgress ? 'completed' : 'in_progress'
                                                onTaskStatusChange?.(task.id!, newStatus)
                                              }}
                                              className="flex-shrink-0 mt-1"
                                            >
                                              {isCompleted ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                              ) : isInProgress ? (
                                                <Circle className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                                              ) : (
                                                <Circle className="h-4 w-4 text-muted-foreground" />
                                              )}
                                            </button>
                                          ) : (
                                            <div className={`h-2 w-2 rounded-full ${taskTypeColors[task.type]} mt-1.5 flex-shrink-0`} />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <p className={`text-xs font-medium ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                                {task.title}
                                              </p>
                                              {task.id && task.type === 'learn' && (
                                                <Link
                                                  href={`/advisor?task=${task.id}`}
                                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                  title="在 Advisor 中学习"
                                                >
                                                  <BookOpen className="h-3 w-3 text-primary hover:text-primary/80" />
                                                </Link>
                                              )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">
                                              {task.durationDays} 天
                                              {showProgress && isInProgress && ' · 进行中'}
                                              {showProgress && isCompleted && ' · 已完成'}
                                            </p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-muted/30 px-6 py-4">
        {showApproval ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">学习</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">实践</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-muted-foreground">测验</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">复盘</span>
              </div>
            </div>
            <Button 
              size="sm" 
              onClick={onApprove}
              className="sm:min-w-[120px]"
            >
              接受地图
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">学习</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">实践</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <span className="text-muted-foreground">测验</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">复盘</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
