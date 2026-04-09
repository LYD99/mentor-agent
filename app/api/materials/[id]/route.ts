import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/materials/[id]
 * 获取指定学习资料的内容
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const material = await prisma.learningMaterial.findUnique({
      where: { id },
    })

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    // 检查权限
    if (material.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ material })
  } catch (error) {
    console.error('Failed to get material:', error)
    return NextResponse.json(
      { error: 'Failed to get material' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/materials/[id]
 * 更新学习资料
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { title, contentMarkdown, contentJson } = body

    // 检查资料是否存在
    const material = await prisma.learningMaterial.findUnique({
      where: { id },
    })

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    // 检查权限
    if (material.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 更新资料
    const updatedMaterial = await prisma.learningMaterial.update({
      where: { id },
      data: {
        title: title || material.title,
        contentMarkdown: contentMarkdown || material.contentMarkdown,
        contentJson: contentJson || material.contentJson,
      },
    })

    return NextResponse.json({ material: updatedMaterial })
  } catch (error) {
    console.error('Failed to update material:', error)
    return NextResponse.json(
      { error: 'Failed to update material' },
      { status: 500 }
    )
  }
}
