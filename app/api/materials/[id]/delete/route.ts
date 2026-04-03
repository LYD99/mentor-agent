import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * 删除学习资料
 * DELETE /api/materials/[id]/delete
 */
export async function DELETE(
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
    const existingMaterial = await prisma.learningMaterial.findUnique({
      where: { id },
      select: {
        userId: true,
        title: true,
      },
    })

    if (!existingMaterial) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    if (existingMaterial.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 删除学习资料
    await prisma.learningMaterial.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `学习资料「${existingMaterial.title}」已删除`,
    })
  } catch (error) {
    console.error('Delete material error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete material',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
