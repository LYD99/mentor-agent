'use client'

import { useMemo } from 'react'

interface GanttTask {
  id: string
  name: string
  start: number
  duration: number
  type: 'stage' | 'goal' | 'task'
  taskType?: 'learn' | 'practice' | 'test' | 'reflect'
  level: number
}

interface GrowthMapGanttProps {
  data: {
    createdAt: string
    stages: Array<{
      id: string
      title: string
      durationWeeks: number
      goals: Array<{
        id: string
        title: string
        tasks: Array<{
          id: string
          title: string
          type: 'learn' | 'practice' | 'test' | 'reflect'
          durationDays: number
        }>
      }>
    }>
  }
}

const taskTypeColors: Record<string, string> = {
  learn: 'bg-blue-500',
  practice: 'bg-green-500',
  test: 'bg-purple-500',
  reflect: 'bg-amber-500',
}

const stageColors = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-purple-600',
  'bg-orange-600',
  'bg-pink-600',
]

export function GrowthMapGantt({ data }: GrowthMapGanttProps) {
  const { tasks, totalDays, weekDates } = useMemo(() => {
    const allTasks: GanttTask[] = []
    let currentDay = 0

    data.stages.forEach((stage, sIdx) => {
      const stageDays = stage.durationWeeks * 7
      
      // Add stage
      allTasks.push({
        id: stage.id,
        name: stage.title,
        start: currentDay,
        duration: stageDays,
        type: 'stage',
        level: 0,
      })

      let stageCurrentDay = currentDay

      stage.goals.forEach((goal) => {
        const goalDays = goal.tasks.reduce((sum, t) => sum + t.durationDays, 0)
        
        // Add goal
        allTasks.push({
          id: goal.id,
          name: goal.title,
          start: stageCurrentDay,
          duration: goalDays,
          type: 'goal',
          level: 1,
        })

        let goalCurrentDay = stageCurrentDay

        goal.tasks.forEach((task) => {
          // Add task
          allTasks.push({
            id: task.id,
            name: task.title,
            start: goalCurrentDay,
            duration: task.durationDays,
            type: 'task',
            taskType: task.type,
            level: 2,
          })

          goalCurrentDay += task.durationDays
        })

        stageCurrentDay += goalDays
      })

      currentDay += stageDays
    })

    // 计算每周的日期
    const startDate = new Date(data.createdAt)
    const weeks = Math.ceil(currentDay / 7)
    const dates: string[] = []
    
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate)
      weekStart.setDate(startDate.getDate() + i * 7)
      const month = weekStart.getMonth() + 1
      const day = weekStart.getDate()
      dates.push(`${month}/${day}`)
    }

    return { tasks: allTasks, totalDays: currentDay, weekDates: dates }
  }, [data])

  const weeks = weekDates.length
  const dayWidth = Math.max(20, Math.min(40, 800 / totalDays)) // 动态调整每天的宽度

  return (
    <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
        <h3 className="font-semibold text-lg">甘特图视图</h3>
        <p className="text-sm text-primary-foreground/80 mt-1">
          总计 {weeks} 周 · {totalDays} 天
        </p>
      </div>

      {/* Gantt Chart */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Timeline Header */}
          <div className="flex border-b border-border bg-muted/30">
            <div className="w-64 flex-shrink-0 p-3 font-medium text-sm border-r border-border">
              任务名称
            </div>
            <div className="flex">
              {weekDates.map((date, i) => (
                <div
                  key={i}
                  className="border-r border-border p-2 text-center text-xs text-muted-foreground"
                  style={{ width: `${dayWidth * 7}px` }}
                >
                  <div className="font-medium">{date}</div>
                  <div className="text-[10px] opacity-60">第{i + 1}周</div>
                </div>
              ))}
            </div>
          </div>

          {/* Task Rows */}
          <div>
            {tasks.map((task, idx) => {
              const stageIdx = tasks.filter(t => t.type === 'stage' && tasks.indexOf(t) <= idx).length - 1
              const colorClass = task.type === 'stage' 
                ? stageColors[stageIdx % stageColors.length]
                : task.type === 'goal'
                ? 'bg-muted-foreground/60'
                : taskTypeColors[task.taskType || 'learn']

              return (
                <div
                  key={task.id}
                  className="flex border-b border-border hover:bg-muted/30 transition-colors"
                >
                  {/* Task Name */}
                  <div
                    className="w-64 flex-shrink-0 p-3 border-r border-border"
                    style={{ paddingLeft: `${task.level * 1.5 + 0.75}rem` }}
                  >
                    <div className="flex items-center gap-2">
                      {task.type === 'task' && (
                        <div className={`h-2 w-2 rounded-full ${colorClass} flex-shrink-0`} />
                      )}
                      <span className={`text-sm ${task.type === 'stage' ? 'font-semibold' : ''} truncate`}>
                        {task.name}
                      </span>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="relative flex-1" style={{ height: '48px' }}>
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 ${colorClass} rounded-md shadow-sm flex items-center justify-center text-xs text-white font-medium overflow-hidden`}
                      style={{
                        left: `${task.start * dayWidth}px`,
                        width: `${task.duration * dayWidth}px`,
                        height: task.type === 'stage' ? '32px' : task.type === 'goal' ? '24px' : '16px',
                      }}
                    >
                      {task.duration >= 3 && (
                        <span className="px-2 truncate">{task.duration}天</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-medium text-foreground">图例：</span>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-blue-500" />
            <span className="text-muted-foreground">学习</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-green-500" />
            <span className="text-muted-foreground">实践</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-purple-500" />
            <span className="text-muted-foreground">测验</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-amber-500" />
            <span className="text-muted-foreground">复盘</span>
          </div>
        </div>
      </div>
    </div>
  )
}
