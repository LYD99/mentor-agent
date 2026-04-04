import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/materials/folders/[id]
 * 获取文件夹详情
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const folder = await prisma.materialFolder.findFirst({
      where: {
        id: id,
        userId,
      },
      include: {
        _count: {
          select: { materials: true, children: true },
        },
        parent: true,
        children: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    return NextResponse.json({
      folder: {
        ...folder,
        materialCount: folder._count.materials,
        childrenCount: folder._count.children,
      },
    })
  } catch (error) {
    console.error('Failed to get folder:', error)
    return NextResponse.json(
      { error: 'Failed to get folder' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/materials/folders/[id]
 * 更新文件夹
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 验证文件夹存在且属于当前用户
    const existing = await prisma.materialFolder.findFirst({
      where: { id: id, userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    const body = await req.json()
    const { name, description, parentId, order } = body

    // 如果修改了名称，检查同名冲突
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.materialFolder.findFirst({
        where: {
          userId,
          name: name.trim(),
          parentId: parentId !== undefined ? parentId : existing.parentId,
          id: { not: id },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Folder with this name already exists' },
          { status: 409 }
        )
      }
    }

    // 如果修改了父文件夹，验证不会形成循环引用
    if (parentId !== undefined && parentId !== existing.parentId) {
      if (parentId === id) {
        return NextResponse.json(
          { error: 'Cannot set folder as its own parent' },
          { status: 400 }
        )
      }

      // 检查是否会形成循环（简单检查：新父文件夹不能是当前文件夹的子孙）
      if (parentId) {
        const isDescendant = await checkIsDescendant(id, parentId)
        if (isDescendant) {
          return NextResponse.json(
            { error: 'Cannot move folder to its descendant' },
            { status: 400 }
          )
        }

        // 验证新父文件夹存在且属于当前用户
        const parent = await prisma.materialFolder.findFirst({
          where: { id: parentId, userId },
        })
        if (!parent) {
          return NextResponse.json(
            { error: 'Parent folder not found' },
            { status: 404 }
          )
        }
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined)
      updateData.description = description?.trim() || null
    if (parentId !== undefined) updateData.parentId = parentId || null
    if (order !== undefined) updateData.order = order

    const folder = await prisma.materialFolder.update({
      where: { id: id },
      data: updateData,
      include: {
        _count: {
          select: { materials: true },
        },
      },
    })

    return NextResponse.json({
      folder: {
        ...folder,
        materialCount: folder._count.materials,
      },
    })
  } catch (error) {
    console.error('Failed to update folder:', error)
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/materials/folders/[id]
 * 删除文件夹
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 验证文件夹存在且属于当前用户
    const folder = await prisma.materialFolder.findFirst({
      where: { id: id, userId },
      include: {
        _count: {
          select: { materials: true, children: true },
        },
      },
    })

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const deleteContents = searchParams.get('deleteContents') === 'true'

    if (deleteContents) {
      // 删除文件夹及其所有内容（包括子文件夹和资料）
      // Prisma 的 onDelete: Cascade 会自动处理
      await prisma.materialFolder.delete({
        where: { id: id },
      })

      return NextResponse.json({
        success: true,
        message: `已删除文件夹及其 ${folder._count.materials} 份资料和 ${folder._count.children} 个子文件夹`,
      })
    } else {
      // 只删除文件夹，资料和子文件夹移至父文件夹（或根目录）
      await prisma.$transaction(async (tx) => {
        // 将资料移至父文件夹
        await tx.learningMaterial.updateMany({
          where: { folderId: id },
          data: { folderId: folder.parentId },
        })

        // 将子文件夹移至父文件夹
        await tx.materialFolder.updateMany({
          where: { parentId: id },
          data: { parentId: folder.parentId },
        })

        // 删除文件夹
        await tx.materialFolder.delete({
          where: { id: id },
        })
      })

      return NextResponse.json({
        success: true,
        message: `已删除文件夹，${folder._count.materials} 份资料和 ${folder._count.children} 个子文件夹已移至上级目录`,
      })
    }
  } catch (error) {
    console.error('Failed to delete folder:', error)
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    )
  }
}

/**
 * 检查 targetId 是否是 folderId 的子孙节点
 */
async function checkIsDescendant(
  folderId: string,
  targetId: string
): Promise<boolean> {
  let current = await prisma.materialFolder.findUnique({
    where: { id: targetId },
    select: { parentId: true },
  })

  while (current?.parentId) {
    if (current.parentId === folderId) {
      return true
    }
    current = await prisma.materialFolder.findUnique({
      where: { id: current.parentId },
      select: { parentId: true },
    })
  }

  return false
}
