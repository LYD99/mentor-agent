import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/lesson/recent
 * 获取用户最近的学习资料（讲义）
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
    // 获取用户的成长地图
    const maps = await prisma.growthMap.findMany({
      where: { userId },
      select: { id: true },
    })

    const mapIds = maps.map(m => m.id)

    if (mapIds.length === 0) {
      return NextResponse.json({ lessons: [] })
    }

    // v2.5: 获取最近生成的学习资料（从 LearningMaterial 表查询）
    const materials = await prisma.learningMaterial.findMany({
      where: {
        userId,
        type: 'daily_lesson',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20, // 最多返回 20 条
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    })

    const formattedLessons = materials.map((material: any) => ({
      type: 'lesson' as const,
      id: material.id,
      title: material.title,
      taskTitle: undefined, // LearningMaterial 没有直接关联 task
      date: material.createdAt.toISOString().split('T')[0],
    }))

    return NextResponse.json({ lessons: formattedLessons })
  } catch (error) {
    console.error('Failed to get recent lessons:', error)
    return NextResponse.json(
      { error: 'Failed to get recent lessons' },
      { status: 500 }
    )
  }
}
