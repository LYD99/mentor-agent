import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/materials
 * 获取用户的所有学习资料（包括日报、周报、月报、学习资料）
 */
export async function GET(req: Request) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'all' | 'daily' | 'weekly' | 'monthly' | 'materials'
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const materials: any[] = []

    // 获取学习资料
    if (!type || type === 'all' || type === 'materials') {
      // 获取 LearningMaterial 表的数据
      const learningMaterials = await prisma.learningMaterial.findMany({
        where: { userId, status: 'learning' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
      materials.push(
        ...learningMaterials.map((m) => ({
          ...m,
          category: 'materials',
          sourceTable: 'LearningMaterial',
        }))
      )

      // v2.5: LearningLesson 表已废弃，统一使用 LearningMaterial 表
    }

    // 获取日报
    if (!type || type === 'all' || type === 'daily') {
      const dailyReports = await prisma.dailyReport.findMany({
        where: { userId },
        orderBy: { reportDate: 'desc' },
        take: limit,
        skip: offset,
      })
      materials.push(
        ...dailyReports.map((r) => ({
          ...r,
          category: 'daily',
        }))
      )
    }

    // 获取周报
    if (!type || type === 'all' || type === 'weekly') {
      const weeklyReports = await prisma.weeklyReport.findMany({
        where: { userId },
        orderBy: { weekStartDate: 'desc' },
        take: limit,
        skip: offset,
      })
      materials.push(
        ...weeklyReports.map((r) => ({
          ...r,
          category: 'weekly',
        }))
      )
    }

    // 获取月报
    if (!type || type === 'all' || type === 'monthly') {
      const monthlyReports = await prisma.monthlyReport.findMany({
        where: { userId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: limit,
        skip: offset,
      })
      materials.push(
        ...monthlyReports.map((r) => ({
          ...r,
          category: 'monthly',
        }))
      )
    }

    // 按创建时间排序
    materials.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.reportDate || a.weekStartDate || 0)
      const dateB = new Date(b.createdAt || b.reportDate || b.weekStartDate || 0)
      return dateB.getTime() - dateA.getTime()
    })

    return NextResponse.json({
      materials: materials.slice(0, limit),
      total: materials.length,
    })
  } catch (error) {
    console.error('Failed to get materials:', error)
    return NextResponse.json(
      { error: 'Failed to get materials' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/materials
 * 创建新的学习资料
 */
export async function POST(req: Request) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { type, title, contentMarkdown, mapId, taskId, tags } = body

    const material = await prisma.learningMaterial.create({
      data: {
        userId,
        type: type || 'custom',
        title,
        contentMarkdown,
        source: 'user_created',
        mapId,
        taskId,
        tags: tags ? JSON.stringify(tags) : null,
      },
    })

    return NextResponse.json({ material })
  } catch (error) {
    console.error('Failed to create material:', error)
    return NextResponse.json(
      { error: 'Failed to create material' },
      { status: 500 }
    )
  }
}
