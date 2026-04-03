import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/bot/[id]
 * 获取单个 Bot 的详细配置（包括敏感信息）
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
    const bot = await prisma.externalBot.findUnique({
      where: { id },
    })

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    return NextResponse.json({ bot })
  } catch (error) {
    console.error('Failed to get bot:', error)
    return NextResponse.json(
      { error: 'Failed to get bot' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/bot/[id]
 * 更新 Bot 配置
 */
export async function PUT(
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
    const {
      name,
      platform,
      description,
      webhookUrl,
      appId,
      appSecret,
      token,
      aesKey,
      enabled,
      config,
    } = body

    const bot = await prisma.externalBot.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(platform !== undefined && { platform }),
        ...(description !== undefined && { description }),
        ...(webhookUrl !== undefined && { webhookUrl }),
        ...(appId !== undefined && { appId }),
        ...(appSecret !== undefined && { appSecret }),
        ...(token !== undefined && { token }),
        ...(aesKey !== undefined && { aesKey }),
        ...(enabled !== undefined && { enabled }),
        ...(config !== undefined && { config: config ? JSON.stringify(config) : null }),
      },
    })

    return NextResponse.json({ bot })
  } catch (error) {
    console.error('Failed to update bot:', error)
    return NextResponse.json(
      { error: 'Failed to update bot' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/bot/[id]
 * 删除 Bot 配置
 */
export async function DELETE(
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
    await prisma.externalBot.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete bot:', error)
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    )
  }
}
