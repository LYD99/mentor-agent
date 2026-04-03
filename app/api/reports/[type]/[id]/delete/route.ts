import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * 删除报告（日报、周报、月报）
 * DELETE /api/reports/[type]/[id]/delete
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { type, id } = await params

  try {
    let existingReport: { userId: string; title: string } | null = null

    // 根据类型查找报告
    switch (type) {
      case 'daily':
        existingReport = await prisma.dailyReport.findUnique({
          where: { id },
          select: { userId: true, title: true },
        })
        break
      case 'weekly':
        existingReport = await prisma.weeklyReport.findUnique({
          where: { id },
          select: { userId: true, title: true },
        })
        break
      case 'monthly':
        existingReport = await prisma.monthlyReport.findUnique({
          where: { id },
          select: { userId: true, title: true },
        })
        break
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    if (!existingReport) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (existingReport.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 删除报告
    switch (type) {
      case 'daily':
        await prisma.dailyReport.delete({ where: { id } })
        break
      case 'weekly':
        await prisma.weeklyReport.delete({ where: { id } })
        break
      case 'monthly':
        await prisma.monthlyReport.delete({ where: { id } })
        break
    }

    return NextResponse.json({
      success: true,
      message: `${type === 'daily' ? '日报' : type === 'weekly' ? '周报' : '月报'}「${existingReport.title}」已删除`,
    })
  } catch (error) {
    console.error('Delete report error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
