import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateGrowthSchedule } from '@/lib/agents/schedule-agent'
import { getGrowthMapContext } from '@/lib/agents/growth-map-context'
import { NextResponse } from 'next/server'

/**
 * 为成长地图创建学习计划
 * POST /api/growth-map/[id]/schedule
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  
  // 解析请求体，获取用户的学习计划偏好
  const body = await request.json().catch(() => ({}))
  const preferences = body.preferences || {}

  try {
    // 验证权限（v2.5: 移除 goals）
    const existingMap = await prisma.growthMap.findUnique({
      where: { id },
      include: {
        stages: {
          include: {
            tasks: true,
          },
        },
      },
    })

    if (!existingMap) {
      return NextResponse.json({ error: 'Map not found' }, { status: 404 })
    }

    if (existingMap.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = session.user.id

    // 获取地图上下文
    const mapContext = await getGrowthMapContext(id)
    
    // 生成学习计划
    const scheduleData = await generateGrowthSchedule({
      mapId: id,
      mapContext,
      preferences: {
        studyReminderTime: preferences.studyReminderTime || '09:00',
        reportReminderTime: preferences.reportReminderTime || '21:00',
        summaryTime: preferences.summaryTime || '23:30',
        weeklyReportDay: preferences.weeklyReportDay ?? 0,
        monthlyReportDay: preferences.monthlyReportDay ?? 1,
        timezone: preferences.timezone || 'Asia/Shanghai',
      },
    })
    
    // v2.5: 删除该地图的旧定时任务和每日计划
    await Promise.all([
      prisma.scheduledTask.deleteMany({
        where: {
          mapId: id,
          userId,
        },
      }),
      prisma.dailyPlan.deleteMany({
        where: {
          mapId: id,
        },
      }),
    ])
    
    // v2.5: 批量创建 DailyPlan 记录
    const dailyPlans = scheduleData.dailySchedule.flatMap((daySchedule) =>
      daySchedule.tasks.map((task) => ({
        mapId: id,
        taskId: task.taskId,
        planDate: new Date(daySchedule.date),
        metadata: JSON.stringify({
          dayOfWeek: daySchedule.dayOfWeek,
          taskTitle: task.taskTitle,
          learningObjectives: task.learningObjectives,
          difficulty: task.difficulty,
          suggestedDuration: task.suggestedDuration,
          prerequisites: task.prerequisites,
          focusAreas: task.focusAreas,
        }),
      }))
    )
    
    await prisma.dailyPlan.createMany({
      data: dailyPlans,
    })
    
    // 创建新的定时任务
    const createdTasks = await prisma.scheduledTask.createMany({
      data: scheduleData.scheduledTasks.map((task) => ({
        mapId: id,
        userId,
        taskType: task.taskType,
        cronExpression: task.cronExpression,
        contentJson: JSON.stringify(task.content),
        status: 'learning',
      })),
    })
    
    // v2.5: 更新地图状态为 planned（移除 learningPlanJson 和 schedulePreferences）
    await prisma.growthMap.update({
      where: { id },
      data: {
        status: 'planned',
      },
    })

    return NextResponse.json({
      success: true,
      message: `已为「${existingMap.title}」创建学习计划`,
      schedule: {
        dailySchedule: scheduleData.dailySchedule.slice(0, 7), // 返回前7天的计划
        scheduledTasks: scheduleData.scheduledTasks.map((t) => ({
          taskType: t.taskType,
          cronExpression: t.cronExpression,
          description: t.content.description,
        })),
        totalDays: scheduleData.dailySchedule.length,
        totalTasks: createdTasks.count,
      },
      preferences: {
        studyReminderTime: preferences.studyReminderTime || '09:00',
        reportReminderTime: preferences.reportReminderTime || '21:00',
        summaryTime: preferences.summaryTime || '23:30',
        weeklyReportDay: preferences.weeklyReportDay ?? 0,
        monthlyReportDay: preferences.monthlyReportDay ?? 1,
      },
    })
  } catch (error) {
    console.error('Create schedule error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create schedule',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * 获取成长地图的学习计划
 * GET /api/growth-map/[id]/schedule
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // 验证权限
    const existingMap = await prisma.growthMap.findUnique({
      where: { id },
    })

    if (!existingMap) {
      return NextResponse.json({ error: 'Map not found' }, { status: 404 })
    }

    if (existingMap.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 获取定时任务
    const scheduledTasks = await prisma.scheduledTask.findMany({
      where: {
        mapId: id,
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      hasSchedule: scheduledTasks.length > 0,
      tasks: scheduledTasks.map((t) => {
        const content = t.contentJson ? JSON.parse(t.contentJson) : {}
        return {
          id: t.id,
          taskType: t.taskType,
          cronExpression: t.cronExpression,
          status: t.status,
          title: content.title,
          description: content.description,
          createdAt: t.createdAt,
        }
      }),
    })
  } catch (error) {
    console.error('Get schedule error:', error)
    return NextResponse.json(
      { error: 'Failed to get schedule' },
      { status: 500 }
    )
  }
}
