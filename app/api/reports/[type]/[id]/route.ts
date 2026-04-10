import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/reports/[type]/[id]
 * 获取报告详情（日报、周报、月报）
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, id } = await params

  try {
    let report: any = null

    // 根据类型查找报告
    switch (type) {
      case 'daily':
        report = await prisma.dailyReport.findUnique({
          where: { id },
        })
        if (report) {
          report.category = 'daily'
        }
        break
      case 'weekly':
        report = await prisma.weeklyReport.findUnique({
          where: { id },
        })
        if (report) {
          report.category = 'weekly'
        }
        break
      case 'monthly':
        report = await prisma.monthlyReport.findUnique({
          where: { id },
        })
        if (report) {
          report.category = 'monthly'
        }
        break
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (report.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Get report error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/reports/[type]/[id]
 * 更新报告内容
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, id } = await params

  try {
    const body = await request.json()
    const { title, contentMarkdown } = body

    // 验证报告存在且属于当前用户
    let existingReport: { userId: string } | null = null

    switch (type) {
      case 'daily':
        existingReport = await prisma.dailyReport.findUnique({
          where: { id },
          select: { userId: true },
        })
        break
      case 'weekly':
        existingReport = await prisma.weeklyReport.findUnique({
          where: { id },
          select: { userId: true },
        })
        break
      case 'monthly':
        existingReport = await prisma.monthlyReport.findUnique({
          where: { id },
          select: { userId: true },
        })
        break
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    if (!existingReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (existingReport.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 更新报告
    let updatedReport: any = null

    switch (type) {
      case 'daily':
        updatedReport = await prisma.dailyReport.update({
          where: { id },
          data: {
            title,
            contentMarkdown,
            updatedAt: new Date(),
          },
        })
        updatedReport.category = 'daily'
        break
      case 'weekly':
        updatedReport = await prisma.weeklyReport.update({
          where: { id },
          data: {
            title,
            contentMarkdown,
            updatedAt: new Date(),
          },
        })
        updatedReport.category = 'weekly'
        break
      case 'monthly':
        updatedReport = await prisma.monthlyReport.update({
          where: { id },
          data: {
            title,
            contentMarkdown,
            updatedAt: new Date(),
          },
        })
        updatedReport.category = 'monthly'
        break
    }

    return NextResponse.json({ report: updatedReport })
  } catch (error) {
    console.error('Update report error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
