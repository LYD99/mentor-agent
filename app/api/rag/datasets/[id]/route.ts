import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { EncryptionService } from '@/lib/services/encryption-service'

/**
 * PATCH /api/rag/datasets/[id]
 * 更新知识库配置
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { id } = await params

    const body = await req.json()
    const {
      name,
      purpose,
      datasetId,
      apiKey,
      apiEndpoint,
      enabled,
      description,
      order,
      retrievalConfig,
    } = body

    // 验证权限
    const dataset = await prisma.ragDataset.findFirst({
      where: { id, userId },
    })

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      )
    }

    // 如果更新名称，检查是否冲突
    if (name && name !== dataset.name) {
      const existing = await prisma.ragDataset.findFirst({
        where: { userId, name, id: { not: id } },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Dataset name already exists' },
          { status: 409 }
        )
      }
    }

    // 构建更新数据
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (purpose !== undefined) updateData.purpose = purpose
    if (datasetId !== undefined) updateData.datasetId = datasetId
    if (apiEndpoint !== undefined) updateData.apiEndpoint = apiEndpoint
    if (enabled !== undefined) updateData.enabled = enabled
    if (description !== undefined) updateData.description = description
    if (order !== undefined) updateData.order = order

    // 如果提供了新的 API Key，加密存储
    if (apiKey) {
      updateData.apiKey = EncryptionService.encrypt(apiKey)
    }

    // 如果提供了 retrievalConfig，序列化存储
    if (retrievalConfig !== undefined) {
      updateData.retrievalConfig = retrievalConfig
        ? JSON.stringify(retrievalConfig)
        : null
    }

    // 更新知识库
    const updated = await prisma.ragDataset.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      dataset: {
        ...updated,
        retrievalConfig: updated.retrievalConfig
          ? JSON.parse(updated.retrievalConfig)
          : null,
      },
    })
  } catch (error) {
    console.error('[RAG API] PATCH /datasets/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update dataset' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rag/datasets/[id]
 * 删除知识库配置
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { id } = await params

    // 验证权限
    const dataset = await prisma.ragDataset.findFirst({
      where: { id, userId },
    })

    if (!dataset) {
      return NextResponse.json(
        { error: 'Dataset not found' },
        { status: 404 }
      )
    }

    // 删除知识库
    await prisma.ragDataset.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[RAG API] DELETE /datasets/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to delete dataset' },
      { status: 500 }
    )
  }
}
