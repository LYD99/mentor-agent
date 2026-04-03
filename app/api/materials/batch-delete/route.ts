import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * 批量删除学习资料（包括讲义和学习资料）
 * POST /api/materials/batch-delete
 * Body: { mapId: string } 或 { mapId: null } 表示删除未分组的资料
 */
export async function POST(request: Request) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { mapId } = body

    // 如果有 mapId，验证该成长地图是否属于当前用户
    if (mapId) {
      const growthMap = await prisma.growthMap.findUnique({
        where: { id: mapId },
        select: { userId: true, title: true },
      })

      if (!growthMap) {
        return NextResponse.json({ error: 'Growth map not found' }, { status: 404 })
      }

      if (growthMap.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // 使用事务批量删除
    const result = await prisma.$transaction(async (tx) => {
      let deletedMaterials = 0

      if (mapId) {
        // v2.5: 删除该成长地图下的所有学习资料
        const materialsResult = await tx.learningMaterial.deleteMany({
          where: {
            mapId: mapId,
            userId: userId,
          },
        })
        deletedMaterials = materialsResult.count
      } else {
        // mapId 为 null，删除所有未分组的学习资料
        const materialsResult = await tx.learningMaterial.deleteMany({
          where: {
            mapId: null,
            userId: userId,
          },
        })
        deletedMaterials = materialsResult.count
      }

      return { deletedMaterials }
    })

    return NextResponse.json({
      success: true,
      message: `成功删除 ${result.deletedMaterials} 份学习资料`,
      deletedMaterials: result.deletedMaterials,
    })
  } catch (error) {
    console.error('Batch delete error:', error)
    return NextResponse.json(
      {
        error: 'Failed to batch delete materials',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
