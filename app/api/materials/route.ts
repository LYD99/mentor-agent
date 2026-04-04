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
  const folderId = searchParams.get('folderId') // 可选：按文件夹过滤
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const materials: any[] = []

    // 获取学习资料
    if (!type || type === 'all' || type === 'materials') {
      // 构建查询条件
      const whereClause: any = { userId, status: 'active' }
      
      // 如果指定了文件夹，添加过滤条件
      if (folderId) {
        whereClause.folderId = folderId
      }

      // 获取 LearningMaterial 表的数据，关联 DailyPlan 获取计划日期
      const learningMaterials = await prisma.learningMaterial.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      })
      
      // 批量查询关联的 DailyPlan
      const dailyPlanIds = learningMaterials
        .map(m => m.dailyPlanId)
        .filter((id): id is string => id !== null)
      
      const dailyPlansMap = new Map<string, Date>()
      if (dailyPlanIds.length > 0) {
        const dailyPlans = await prisma.dailyPlan.findMany({
          where: { id: { in: dailyPlanIds } },
          select: { id: true, planDate: true },
        })
        dailyPlans.forEach(plan => {
          dailyPlansMap.set(plan.id, plan.planDate)
        })
      }
      
      materials.push(
        ...learningMaterials.map((m) => ({
          ...m,
          category: 'materials',
          sourceTable: 'LearningMaterial',
          planDate: m.dailyPlanId ? dailyPlansMap.get(m.dailyPlanId)?.toISOString() : null,
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
    const { type, title, contentMarkdown, contentJson, mapId, taskId, tags } = body

    const material = await prisma.learningMaterial.create({
      data: {
        userId,
        type: type || 'custom',
        title,
        contentMarkdown,
        contentJson: contentJson || null,
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
