import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { NextResponse } from 'next/server'
import {
  getEnvConfigDefinitions,
  getAllEnvValues,
  setEnvValue,
  requiresRestart,
} from '@/lib/config/env-service'

/**
 * GET /api/config/env
 * 获取所有环境变量配置定义和值
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
    const definitions = getEnvConfigDefinitions()
    const { values, actualValues } = getAllEnvValues()

    return NextResponse.json({
      definitions,
      values,
      actualValues,
    })
  } catch (error) {
    console.error('Failed to get env configs:', error)
    return NextResponse.json(
      { error: 'Failed to get env configs' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/config/env
 * 更新环境变量值
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
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'key and value are required' },
        { status: 400 }
      )
    }

    setEnvValue(key, value)

    return NextResponse.json({
      success: true,
      requiresRestart: requiresRestart(key),
    })
  } catch (error) {
    console.error('Failed to update env config:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update env config' },
      { status: 500 }
    )
  }
}
