import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/bot
 * 获取所有外部 Bot 配置
 */
export async function GET() {
  const session = await auth()
  let userId = session?.user?.id
  
  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const bots = await prisma.externalBot.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        platform: true,
        description: true,
        webhookUrl: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
        // 不返回敏感信息
      },
    })

    return NextResponse.json({ bots })
  } catch (error) {
    console.error('Failed to get bots:', error)
    return NextResponse.json(
      { error: 'Failed to get bots' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bot
 * 创建新的外部 Bot 配置
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
    const {
      name,
      platform,
      description,
      webhookUrl,
      appId,
      appSecret,
      token,
      aesKey,
      enabled = true,
      config,
    } = body

    if (!name || !platform) {
      return NextResponse.json(
        { error: 'name and platform are required' },
        { status: 400 }
      )
    }

    const bot = await prisma.externalBot.create({
      data: {
        name,
        platform,
        description,
        webhookUrl,
        appId,
        appSecret,
        token,
        aesKey,
        enabled,
        config: config ? JSON.stringify(config) : null,
      },
    })

    return NextResponse.json({ bot })
  } catch (error) {
    console.error('Failed to create bot:', error)
    return NextResponse.json(
      { error: 'Failed to create bot' },
      { status: 500 }
    )
  }
}
