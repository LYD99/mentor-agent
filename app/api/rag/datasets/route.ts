import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { EncryptionService } from '@/lib/services/encryption-service'

/**
 * GET /api/rag/datasets
 * 获取用户的知识库列表
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const datasets = await prisma.ragDataset.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        purpose: true,
        datasetId: true,
        apiEndpoint: true,
        enabled: true,
        description: true,
        order: true,
        retrievalConfig: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // 解析 retrievalConfig
    const formattedDatasets = datasets.map((d) => ({
      ...d,
      retrievalConfig: d.retrievalConfig ? JSON.parse(d.retrievalConfig) : null,
    }))

    return NextResponse.json({ datasets: formattedDatasets })
  } catch (error) {
    console.error('[RAG API] GET /datasets error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch datasets' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rag/datasets
 * 创建知识库配置
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    const body = await req.json()
    const {
      name,
      purpose,
      datasetId,
      apiKey,
      apiEndpoint = 'https://api.dify.ai/v1',
      description,
      retrievalConfig,
    } = body

    // 验证必需字段
    if (!name || !purpose || !datasetId || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 检查名称是否已存在
    const existing = await prisma.ragDataset.findFirst({
      where: { userId, name },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Dataset name already exists' },
        { status: 409 }
      )
    }

    // 加密 API Key
    const encryptedApiKey = EncryptionService.encrypt(apiKey)

    // 创建知识库
    const dataset = await prisma.ragDataset.create({
      data: {
        userId,
        name,
        purpose,
        datasetId,
        apiKey: encryptedApiKey,
        apiEndpoint,
        description,
        retrievalConfig: retrievalConfig ? JSON.stringify(retrievalConfig) : null,
      },
    })

    return NextResponse.json({
      dataset: {
        ...dataset,
        retrievalConfig: dataset.retrievalConfig
          ? JSON.parse(dataset.retrievalConfig)
          : null,
      },
    })
  } catch (error) {
    console.error('[RAG API] POST /datasets error:', error)
    return NextResponse.json(
      { error: 'Failed to create dataset' },
      { status: 500 }
    )
  }
}
