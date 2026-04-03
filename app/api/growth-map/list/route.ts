import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/growth-map/list
 * 获取用户的成长地图列表（用于聊天时 @ 选择）
 */
export async function GET() {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // v2.5: 移除 goals 查询
    const maps = await prisma.growthMap.findMany({
      where: {
        userId,
      },
      orderBy: [
        { updatedAt: 'desc' },
        { status: 'desc' },
      ],
      include: {
        stages: {
          include: {
            tasks: true,
          },
        },
      },
    })

    // v2.5: 批量查询所有地图的 DailyPlan 数据（用于学习资源选择器）
    const mapIds = maps.map(m => m.id)
    const allDailyPlans = await prisma.dailyPlan.findMany({
      where: {
        mapId: { in: mapIds },
      },
      orderBy: {
        planDate: 'asc',
      },
    })
    
    // 按 mapId 分组
    const dailyPlansByMap = new Map<string, typeof allDailyPlans>()
    for (const plan of allDailyPlans) {
      if (!dailyPlansByMap.has(plan.mapId)) {
        dailyPlansByMap.set(plan.mapId, [])
      }
      dailyPlansByMap.get(plan.mapId)!.push(plan)
    }

    const formattedMaps = maps.map((map) => {
      const stageCount = map.stages.length
      // v2.5: 直接计算 task 数量
      const taskCount = map.stages.reduce(
        (sum, stage) => sum + stage.tasks.length,
        0
      )

      // v2.5: 从 DailyPlan 表获取计划数据
      const dailyPlans = dailyPlansByMap.get(map.id) || []
      const scheduleDays = dailyPlans.length
      
      // 构建 learningPlanJson（兼容前端组件）
      let learningPlanJson = null
      if (dailyPlans.length > 0) {
        // 按日期分组（一天可能有多个任务）
        const dailySchedule = Object.entries(
          dailyPlans.reduce((acc, plan) => {
            const dateKey = plan.planDate.toISOString().split('T')[0]
            if (!acc[dateKey]) {
              acc[dateKey] = {
                date: dateKey,
                dayOfWeek: new Date(plan.planDate).getDay(),
                tasks: [],
              }
            }
            
            const metadata = plan.metadata ? JSON.parse(plan.metadata) : {}
            
            // 查找对应的 LearningTask
            const task = map.stages
              .flatMap(s => s.tasks)
              .find(t => t.id === plan.taskId)
            
            acc[dateKey].tasks.push({
              taskTitle: task?.title || '未知任务',
              learningObjectives: metadata.learningObjectives || [],
              estimatedMinutes: metadata.suggestedDuration ? parseInt(metadata.suggestedDuration) : undefined,
            })
            
            return acc
          }, {} as Record<string, any>)
        )
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([_, day]) => day)
        
        learningPlanJson = JSON.stringify({
          dailySchedule,
          generatedAt: dailyPlans[0]?.createdAt.toISOString() || new Date().toISOString(),
        })
      }

      return {
        id: map.id,
        title: map.title,
        description: map.description,
        status: map.status,
        stageCount,
        taskCount,
        scheduleDays,
        scheduleTasks: taskCount, // 添加 scheduleTasks 字段
        learningPlanJson, // 添加 learningPlanJson 字段
        createdAt: map.createdAt,
        updatedAt: map.updatedAt,
      }
    })

    return NextResponse.json({ maps: formattedMaps })
  } catch (error) {
    console.error('Failed to get growth maps:', error)
    return NextResponse.json(
      { error: 'Failed to get growth maps' },
      { status: 500 }
    )
  }
}
