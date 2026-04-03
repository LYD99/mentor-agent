import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { NextResponse } from 'next/server'
import {
  getConfigDefinitions,
  getAllConfigValues,
  setConfigValue,
  deleteConfigValue,
} from '@/lib/config/config-service'

/**
 * GET /api/config
 * 获取所有配置定义和值
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
    const definitions = getConfigDefinitions()
    const values = await getAllConfigValues()

    return NextResponse.json({
      definitions,
      values,
    })
  } catch (error) {
    console.error('Failed to get configs:', error)
    return NextResponse.json(
      { error: 'Failed to get configs' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/config
 * 更新配置值
 */
export async function PUT(request: Request) {
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
    const { category, key, value } = body

    if (!category || !key || value === undefined) {
      return NextResponse.json(
        { error: 'category, key, and value are required' },
        { status: 400 }
      )
    }

    await setConfigValue(category, key, value)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update config:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update config' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/config
 * 删除配置值（恢复为默认值）
 */
export async function DELETE(request: Request) {
  const session = await auth()
  let userId = session?.user?.id

  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const key = searchParams.get('key')

    if (!category || !key) {
      return NextResponse.json(
        { error: 'category and key are required' },
        { status: 400 }
      )
    }

    await deleteConfigValue(category, key)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete config:', error)
    return NextResponse.json(
      { error: 'Failed to delete config' },
      { status: 500 }
    )
  }
}
