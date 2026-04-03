'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

type TaskType = 'learn' | 'practice' | 'test' | 'reflect'

interface Task {
  title: string
  description: string
  type: TaskType
  durationDays: number
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
}

const taskTypeColors: Record<TaskType, string> = {
  learn: 'bg-blue-100 text-blue-700 border-blue-200',
  practice: 'bg-green-100 text-green-700 border-green-200',
  test: 'bg-purple-100 text-purple-700 border-purple-200',
  reflect: 'bg-amber-100 text-amber-700 border-amber-200',
}

const taskTypeLabels: Record<TaskType, string> = {
  learn: '学习',
  practice: '实践',
  test: '测验',
  reflect: '复盘',
}

export function GrowthMapCard({ data }: { data: GrowthMapData }) {
  const totalWeeks = data.stages.reduce((sum, s) => sum + s.durationWeeks, 0)
  const totalTasks = data.stages.reduce(
    (sum, s) => sum + s.goals.reduce((gSum, g) => gSum + g.tasks.length, 0),
    0
  )

  return (
    <div className="not-prose my-4 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg font-semibold text-foreground mb-1 truncate">
              {data.title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {data.description}
            </p>
          </div>
          <Link href={`/plan/${data.mapId}`}>
            <Button size="sm" variant="default">
              查看详情
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {totalWeeks} 周
          </span>
          <span>{data.stages.length} 个阶段</span>
          <span>{totalTasks} 个任务</span>
        </div>
      </div>

      {/* Stages */}
      <div className="divide-y divide-border">
        {data.stages.slice(0, 3).map((stage, sIdx) => (
          <div key={sIdx} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {sIdx + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <h4 className="font-semibold text-sm text-foreground">
                    {stage.title}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {stage.durationWeeks} 周
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {stage.description}
                </p>

                {/* Goals preview */}
                <div className="space-y-2">
                  {stage.goals.slice(0, 2).map((goal, gIdx) => (
                    <div key={gIdx} className="pl-3 border-l-2 border-muted">
                      <div className="flex items-start gap-2">
                        <Circle className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">
                            {goal.title}
                          </p>
                          {goal.tasks.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {goal.tasks.slice(0, 3).map((task, tIdx) => (
                                <span
                                  key={tIdx}
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                    taskTypeColors[task.type]
                                  }`}
                                >
                                  {taskTypeLabels[task.type]}
                                </span>
                              ))}
                              {goal.tasks.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{goal.tasks.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {stage.goals.length > 2 && (
                    <p className="text-xs text-muted-foreground pl-3">
                      还有 {stage.goals.length - 2} 个目标...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {data.stages.length > 3 && (
          <div className="p-3 text-center">
            <Link href={`/plan/${data.mapId}`}>
              <Button size="sm" variant="ghost" className="text-xs">
                查看全部 {data.stages.length} 个阶段
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
