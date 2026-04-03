import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * 删除成长地图（级联删除所有关联数据）
 * DELETE /api/growth-map/[id]/delete
 */
export async function DELETE(
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
      select: {
        userId: true,
        title: true,
      },
    })

    if (!existingMap) {
      return NextResponse.json({ error: 'Map not found' }, { status: 404 })
    }

    if (existingMap.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 删除地图（Prisma 会自动级联删除关联的 stages, goals, tasks, lessons, scheduledTasks 等）
    await prisma.growthMap.delete({
      where: { id },
    })

    // 同时删除关联的学习资料
    await prisma.learningMaterial.deleteMany({
      where: {
        mapId: id,
        userId: session.user.id,
      },
    })

    // 删除关联的日报、周报、月报
    await Promise.all([
      prisma.dailyReport.deleteMany({
        where: { mapId: id, userId: session.user.id },
      }),
      prisma.weeklyReport.deleteMany({
        where: { mapId: id, userId: session.user.id },
      }),
      prisma.monthlyReport.deleteMany({
        where: { mapId: id, userId: session.user.id },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: `成长地图「${existingMap.title}」已删除`,
    })
  } catch (error) {
    console.error('Delete map error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete map',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
