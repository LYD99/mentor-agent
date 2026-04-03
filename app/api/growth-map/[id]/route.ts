import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

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
    // v2.5: 查询 map 和关联的 stages/tasks
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
      return NextResponse.json({ error: 'Map not found' }, { status: 404 })
    }

    if (map.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // v2.5: 查询 DailyPlan 数据并构建 learningPlanJson 格式（向后兼容）
    const dailyPlans = await prisma.dailyPlan.findMany({
      where: { mapId: id },
      orderBy: { planDate: 'asc' },
    })

    // 按日期分组，因为一天可能有多个任务
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
          taskId: plan.taskId,
          taskTitle: task?.title || '未知任务',
          learningObjectives: metadata.learningObjectives || [],
          difficulty: metadata.difficulty || 'intermediate',
          suggestedDuration: metadata.suggestedDuration || '60分钟',
          prerequisites: metadata.prerequisites || [],
          focusAreas: metadata.focusAreas || [],
          estimatedMinutes: metadata.estimatedMinutes || 60,
        })
        
        return acc
      }, {} as Record<string, any>)
    )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([_, day]) => day)

    // 构建兼容的响应格式
    const response = {
      id: map.id,
      title: map.title,
      description: map.description,
      status: map.status,
      userId: map.userId,
      learningPlanJson: dailySchedule.length > 0 ? JSON.stringify({
        dailySchedule,
        generatedAt: dailyPlans[0]?.createdAt.toISOString() || new Date().toISOString(),
      }) : null,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get map error:', error)
    return NextResponse.json(
      { error: 'Failed to get map' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

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

    // 如果只更新状态（简化的激活操作）
    if (body.status && !body.stages) {
      const updatedMap = await prisma.growthMap.update({
        where: { id },
        data: {
          status: body.status,
        },
      })
      return NextResponse.json({ success: true, map: updatedMap })
    }

    // v2.5: 完整更新 - 删除旧的 stages（级联删除 tasks 和 lessons）
    await prisma.growthStage.deleteMany({
      where: { mapId: id },
    })

    // v2.5: 更新地图和创建新的结构（扁平化 Goal）
    const updatedMap = await prisma.growthMap.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        status: body.status || existingMap.status,
        stages: {
          create: body.stages.map((stage: any, sIdx: number) => {
            // 扁平化：将所有 Goal 下的 Task 合并到 Stage
            const allTasks = stage.goals 
              ? stage.goals.flatMap((goal: any) => goal.tasks || [])
              : (stage.tasks || [])
            
            return {
              stageOrder: sIdx,
              title: stage.title,
              description: stage.description,
              durationWeeks: stage.durationWeeks,
              tasks: {
                create: allTasks.map((task: any, tIdx: number) => ({
                  taskOrder: tIdx,
                  title: task.title,
                  description: task.description,
                  type: task.type,
                  durationDays: task.durationDays,
                })),
              },
            }
          }),
        },
      },
    })

    return NextResponse.json({ success: true, map: updatedMap })
  } catch (error) {
    console.error('Update map error:', error)
    return NextResponse.json(
      { error: 'Failed to update map' },
      { status: 500 }
    )
  }
}
