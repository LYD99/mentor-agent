import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { FileProcessor } from '@/lib/services/file-processor'

/**
 * POST /api/materials/batch-upload
 * 批量上传学习资料文件
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
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const folderId = formData.get('folderId') as string | null
    const mapId = formData.get('mapId') as string | null
    const tagsStr = formData.get('tags') as string | null
    const additionalTags = tagsStr ? JSON.parse(tagsStr) : []

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // 验证文件夹（如果指定）
    if (folderId) {
      const folder = await prisma.materialFolder.findFirst({
        where: { id: folderId, userId },
      })
      if (!folder) {
        return NextResponse.json(
          { error: 'Folder not found' },
          { status: 404 }
        )
      }
    }

    // 验证成长地图（如果指定）
    if (mapId) {
      const map = await prisma.growthMap.findFirst({
        where: { id: mapId, userId },
      })
      if (!map) {
        return NextResponse.json(
          { error: 'Growth map not found' },
          { status: 404 }
        )
      }
    }

    const results: {
      success: any[]
      failed: { filename: string; error: string }[]
    } = {
      success: [],
      failed: [],
    }

    // 处理每个文件
    for (const file of files) {
      try {
        // 验证文件类型
        if (!FileProcessor.isSupportedFileType(file.name)) {
          results.failed.push({
            filename: file.name,
            error: `不支持的文件类型: ${FileProcessor.getFileTypeDescription(file.name)}`,
          })
          continue
        }

        // 验证文件大小（10MB）
        if (!FileProcessor.isValidFileSize(file.size, 10)) {
          results.failed.push({
            filename: file.name,
            error: '文件大小超过 10MB 限制',
          })
          continue
        }

        // 处理文件
        const processed = await FileProcessor.processFile(file, {
          extractMetadata: true,
        })

        // 合并标签
        const allTags = [
          ...(processed.tags || []),
          ...additionalTags,
          `imported:${new Date().toISOString().split('T')[0]}`,
        ]

        // 构建 contentJson
        const contentJson = JSON.stringify({
          originalFilename: file.name,
          fileSize: file.size,
          fileType: file.type,
          metadata: processed.metadata,
          importedAt: new Date().toISOString(),
        })

        // 保存到数据库
        const material = await prisma.learningMaterial.create({
          data: {
            userId,
            type: 'imported',
            title: processed.title,
            contentMarkdown: processed.contentMarkdown,
            contentJson,
            source: 'imported',
            folderId: folderId || null,
            mapId: mapId || null,
            tags: JSON.stringify(allTags),
            status: 'active',
          },
        })

        results.success.push({
          id: material.id,
          title: material.title,
          filename: file.name,
        })
      } catch (error) {
        console.error(`Failed to process file ${file.name}:`, error)
        results.failed.push({
          filename: file.name,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
      }
    }

    return NextResponse.json({
      success: results.success,
      failed: results.failed,
      summary: {
        total: files.length,
        succeeded: results.success.length,
        failed: results.failed.length,
      },
    })
  } catch (error) {
    console.error('Batch upload error:', error)
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    )
  }
}

// 配置 Next.js API 路由以支持文件上传
export const config = {
  api: {
    bodyParser: false, // 禁用默认的 body parser，使用 formData
  },
}
