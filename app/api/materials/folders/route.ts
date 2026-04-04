import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * GET /api/materials/folders
 * 获取用户的文件夹列表（树形结构）
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

  try {
    // 获取所有文件夹
    const folders = await prisma.materialFolder.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { materials: true },
        },
      },
    })

    // 构建树形结构
    const folderMap = new Map<string, any>()
    const rootFolders: any[] = []

    // 第一遍：创建所有节点
    folders.forEach((folder) => {
      folderMap.set(folder.id, {
        ...folder,
        materialCount: folder._count.materials,
        children: [],
      })
    })

    // 第二遍：构建树形结构
    folders.forEach((folder) => {
      const node = folderMap.get(folder.id)
      if (folder.parentId) {
        const parent = folderMap.get(folder.parentId)
        if (parent) {
          parent.children.push(node)
        } else {
          // 父节点不存在，放到根节点
          rootFolders.push(node)
        }
      } else {
        rootFolders.push(node)
      }
    })

    return NextResponse.json({
      folders: rootFolders,
      total: folders.length,
    })
  } catch (error) {
    console.error('Failed to get folders:', error)
    return NextResponse.json(
      { error: 'Failed to get folders' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/materials/folders
 * 创建新文件夹
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
    const { name, description, parentId, order } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    // 检查同名文件夹（同一父文件夹下）
    const existing = await prisma.materialFolder.findFirst({
      where: {
        userId,
        name: name.trim(),
        parentId: parentId || null,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Folder with this name already exists' },
        { status: 409 }
      )
    }

    // 如果指定了父文件夹，验证其存在且属于当前用户
    if (parentId) {
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

    const folder = await prisma.materialFolder.create({
      data: {
        userId,
        name: name.trim(),
        description: description?.trim() || null,
        parentId: parentId || null,
        order: order ?? 0,
      },
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
    console.error('Failed to create folder:', error)
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    )
  }
}
