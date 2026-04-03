import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * 接受地图 API
 * 将地图状态从 draft 改为 pending_plan
 * 不触发学习计划生成，由用户决定何时生成
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

    // 检查状态，避免重复接受
    if (existingMap.status !== 'draft') {
      return NextResponse.json(
        { error: '此地图已经接受过了', currentStatus: existingMap.status },
        { status: 400 }
      )
    }

    // 更新地图状态为 pending_plan（已接受，待生成学习计划）
    const updatedMap = await prisma.growthMap.update({
      where: { id },
      data: {
        status: 'pending_plan',
      },
    })

    return NextResponse.json({
      success: true,
      map: updatedMap,
      message: '地图已接受！',
    })
  } catch (error) {
    console.error('Approve map error:', error)
    return NextResponse.json(
      { error: 'Failed to approve map' },
      { status: 500 }
    )
  }
}
