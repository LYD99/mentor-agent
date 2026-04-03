import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/reports/daily
 * 获取用户的日报列表
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
  const limit = parseInt(searchParams.get('limit') || '30')
  const offset = parseInt(searchParams.get('offset') || '0')
  const mapId = searchParams.get('mapId')

  try {
    const where: any = { userId }
    if (mapId) {
      where.mapId = mapId
    }

    const reports = await prisma.dailyReport.findMany({
      where,
      orderBy: { reportDate: 'desc' },
      take: limit,
      skip: offset,
    })

    const total = await prisma.dailyReport.count({ where })

    return NextResponse.json({ reports, total })
  } catch (error) {
    console.error('Failed to get daily reports:', error)
    return NextResponse.json(
      { error: 'Failed to get daily reports' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reports/daily
 * 创建新的日报
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
    const {
      reportDate,
      title,
      contentMarkdown,
      mapId,
      mood,
      achievements,
      challenges,
      summaryJson,
    } = body

    const report = await prisma.dailyReport.create({
      data: {
        userId,
        reportDate: new Date(reportDate || new Date()),
        type: 'user',
        title,
        contentMarkdown,
        mapId,
        mood,
        achievements: achievements ? JSON.stringify(achievements) : null,
        challenges: challenges ? JSON.stringify(challenges) : null,
        summaryJson: summaryJson ? JSON.stringify(summaryJson) : null,
      },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Failed to create daily report:', error)
    return NextResponse.json(
      { error: 'Failed to create daily report' },
      { status: 500 }
    )
  }
}
