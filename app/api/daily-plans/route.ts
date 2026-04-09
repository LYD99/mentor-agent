import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mapId = searchParams.get('mapId')

    // 构建查询条件
    const where: any = {}
    
    if (mapId) {
      // 验证用户是否有权限访问该地图
      const map = await prisma.growthMap.findUnique({
        where: { id: mapId },
        select: { userId: true },
      })
      
      if (!map || map.userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      
      where.mapId = mapId
    } else {
      // 如果没有指定 mapId，获取用户所有地图的计划
      const userMaps = await prisma.growthMap.findMany({
        where: { userId: session.user.id },
        select: { id: true },
      })
      
      where.mapId = {
        in: userMaps.map(m => m.id),
      }
    }

    const dailyPlans = await prisma.dailyPlan.findMany({
      where,
      select: {
        mapId: true,
        taskId: true,
        planDate: true,
      },
      orderBy: { planDate: 'asc' },
    })

    return NextResponse.json({
      plans: dailyPlans.map(plan => ({
        mapId: plan.mapId,
        taskId: plan.taskId,
        planDate: plan.planDate.toISOString().split('T')[0],
      })),
    })
  } catch (error) {
    console.error('Failed to fetch daily plans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch daily plans' },
      { status: 500 }
    )
  }
}
