import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOrCreateDevUserId } from '@/lib/dev-user'

/**
 * PATCH /api/daily-plans/[id]/status
 * 更新每日学习计划的状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    const userId = session?.user?.id || (await getOrCreateDevUserId())

    // 安全地解析 JSON
    let body
    try {
      const text = await request.text()
      console.log('[Daily Plan Status] Request body text:', text)
      body = text ? JSON.parse(text) : {}
    } catch (e) {
      console.error('[Daily Plan Status] JSON parse error:', e)
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { status } = body
    console.log('[Daily Plan Status] Parsed status:', status)

    if (!status || !['pending', 'learning', 'done'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, learning, or done' },
        { status: 400 }
      )
    }

    // 查找计划
    const plan = await prisma.dailyPlan.findUnique({
      where: { id },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // 验证权限（通过 GrowthMap）
    const map = await prisma.growthMap.findFirst({
      where: {
        id: plan.mapId,
        userId,
      },
    })

    if (!map) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 更新状态和时间戳
    const updateData: any = { status }

    if (status === 'learning' && !plan.startedAt) {
      updateData.startedAt = new Date()
    }

    if (status === 'done' && !plan.completedAt) {
      updateData.completedAt = new Date()
      // 如果没有 startedAt，也设置一个
      if (!plan.startedAt) {
        updateData.startedAt = new Date()
      }
    }

    // 如果从 done 回退到 learning，清除 completedAt
    if (status === 'learning' && plan.status === 'done') {
      updateData.completedAt = null
    }

    // 如果回退到 pending，清除所有时间戳
    if (status === 'pending') {
      updateData.startedAt = null
      updateData.completedAt = null
    }

    const updatedPlan = await prisma.dailyPlan.update({
      where: { id },
      data: updateData,
    })

    // 同步更新 LearningTask 的状态
    // 当 DailyPlan 状态变为 done 时，更新对应的 LearningTask 为 completed
    // 当 DailyPlan 状态变为 learning 时，更新对应的 LearningTask 为 in_progress
    // 当 DailyPlan 状态变为 pending 时，更新对应的 LearningTask 为 pending
    try {
      const taskStatusMap: Record<string, string> = {
        'pending': 'pending',
        'learning': 'in_progress',
        'done': 'completed',
      }
      
      const taskStatus = taskStatusMap[status]
      
      if (taskStatus) {
        // 检查该 taskId 的所有 DailyPlan，如果都完成了，才标记 LearningTask 为 completed
        if (status === 'done') {
          const allPlansForTask = await prisma.dailyPlan.findMany({
            where: {
              mapId: plan.mapId,
              taskId: plan.taskId,
            },
          })
          
          const allDone = allPlansForTask.every(p => p.id === id || p.status === 'done')
          
          if (allDone) {
            await prisma.learningTask.update({
              where: { id: plan.taskId },
              data: { status: 'completed' },
            })
            console.log(`[Daily Plan Status] Updated LearningTask ${plan.taskId} to completed`)
          }
        } else {
          // 对于 learning 和 pending 状态，直接更新
          await prisma.learningTask.update({
            where: { id: plan.taskId },
            data: { status: taskStatus },
          })
          console.log(`[Daily Plan Status] Updated LearningTask ${plan.taskId} to ${taskStatus}`)
        }
      }
    } catch (error) {
      console.error('[Daily Plan Status] Failed to sync LearningTask status:', error)
      // 不影响主流程，只记录错误
    }

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
    })
  } catch (error) {
    console.error('Update daily plan status error:', error)
    return NextResponse.json(
      { error: 'Failed to update plan status' },
      { status: 500 }
    )
  }
}
