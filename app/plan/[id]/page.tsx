import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { GrowthMapDetail } from '@/components/growth-map/growth-map-detail'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const { id } = await params

  const map = await prisma.growthMap.findUnique({
    where: { id },
    include: {
      stages: {
        orderBy: { stageOrder: 'asc' },
        include: {
          tasks: {
            orderBy: { taskOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!map) {
    notFound()
  }

  // v2.5: 单独查询 scheduledTasks（ScheduledTask 表没有与 GrowthMap 的直接关系）
  const scheduledTasks = await prisma.scheduledTask.findMany({
    where: { 
      mapId: id,
      status: 'learning' 
    },
    orderBy: { createdAt: 'asc' },
  })

  // Check ownership
  if (map.userId !== session.user.id) {
    return (
      <div className="container mx-auto p-8">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          您没有权限查看此学习地图
        </div>
      </div>
    )
  }

  // v2.5: 从 DailyPlan 表查询学习计划数据
  const dailyPlans = await prisma.dailyPlan.findMany({
    where: { mapId: id },
    orderBy: { planDate: 'asc' },
  })

  // 构建 learningPlan 对象（兼容前端组件格式）
  // 按日期分组，因为一天可能有多个任务
  const learningPlan = dailyPlans.length > 0 ? {
    dailySchedule: Object.entries(
      dailyPlans.reduce((acc, plan) => {
        const dateKey = plan.planDate.toISOString().split('T')[0]
        if (!acc[dateKey]) {
          acc[dateKey] = {
            date: dateKey,
            dayOfWeek: new Date(plan.planDate).getDay(),
            tasks: [],
            createdAt: plan.createdAt,
          }
        }
        
        const metadata = plan.metadata ? JSON.parse(plan.metadata) : {}
        
        // 查找对应的 LearningTask
        const task = map.stages
          .flatMap(s => s.tasks)
          .find(t => t.id === plan.taskId)
        
        acc[dateKey].tasks.push({
          taskId: plan.taskId,
          taskTitle: task?.title || '未知任务',
          learningObjectives: metadata.learningObjectives || [],
          difficulty: metadata.difficulty || 'intermediate',
          suggestedDuration: metadata.suggestedDuration || '60分钟',
          prerequisites: metadata.prerequisites || [],
          focusAreas: metadata.focusAreas || [],
        })
        
        return acc
      }, {} as Record<string, any>)
    )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([_, day]) => ({
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      tasks: day.tasks,
    })),
    generatedAt: dailyPlans[0]?.createdAt.toISOString() || new Date().toISOString(),
  } : null

  const schedulePreferences = null

  // v2.5: Transform database structure to component format（扁平化，tasks 直接属于 stage）
  const mapData = {
    mapId: map.id,
    title: map.title,
    description: map.description || '',
    status: map.status,
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
    learningPlan,
    schedulePreferences,
    scheduledTasks: scheduledTasks || [],
    stages: map.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      description: stage.description || '',
      durationWeeks: stage.durationWeeks || 0,
      goals: [{
        id: stage.id,
        title: stage.title,
        description: stage.description || '',
        tasks: stage.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description || '',
          type: task.type as 'learn' | 'practice' | 'test' | 'reflect',
          durationDays: task.durationDays || 0,
          status: task.status as 'pending' | 'in_progress' | 'completed',
        })),
      }],
    })),
  }

  return <GrowthMapDetail data={mapData} />
}
