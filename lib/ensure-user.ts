import { prisma } from '@/lib/db'

/**
 * 确保用户在数据库中存在
 * 如果不存在，自动创建用户记录
 * 
 * 这解决了 OAuth 认证后用户 ID 存在于 session 但不在数据库中的问题
 */
export async function ensureUserExists(params: {
  id: string
  email?: string | null
  name?: string | null
  image?: string | null
}): Promise<string> {
  try {
    // 检查用户是否存在
    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (existing) {
      return existing.id
    }

    // 用户不存在，创建新用户
    console.log(`[EnsureUser] Creating user record for ${params.id}`)
    
    const user = await prisma.user.create({
      data: {
        id: params.id,
        email: params.email || `user-${params.id}@system.local`,
        name: params.name || 'User',
        password: '', // OAuth 用户不需要密码
      },
    })

    console.log(`[EnsureUser] User created: ${user.id}`)
    return user.id
  } catch (error) {
    console.error('[EnsureUser] Failed to ensure user exists:', error)
    throw error
  }
}
