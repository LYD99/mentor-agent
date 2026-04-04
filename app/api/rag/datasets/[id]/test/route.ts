import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { RagService } from '@/lib/services/rag-service'
import { EncryptionService } from '@/lib/services/encryption-service'

/**
 * POST /api/rag/datasets/[id]/test
 * 测试知识库连接
 */
export async function POST(
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

    const body = await req.json()
    const { query = 'test' } = body

    // 使用 testConnection 方法，不发送 retrieval_model
    // 这样可以避免因缺少嵌入模型配置导致的错误
    const result = await RagService.testConnection({
      datasetId: dataset.datasetId,
      apiKey: EncryptionService.decrypt(dataset.apiKey),
      apiEndpoint: dataset.apiEndpoint,
      query,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[RAG API] POST /datasets/[id]/test error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || '测试失败',
      },
      { status: 500 }
    )
  }
}
