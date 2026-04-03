import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

const DEV_EMAIL = 'dev@localhost'

/**
 * In development, Mentor/API routes can attach chat to this user when no session exists.
 */
export async function getOrCreateDevUserId(): Promise<string> {
  try {
    const existing = await prisma.user.findUnique({ where: { email: DEV_EMAIL } })
    if (existing) return existing.id

    const user = await prisma.user.create({
      data: {
        email: DEV_EMAIL,
        name: 'Local Dev',
        password: await bcrypt.hash('dev-only-not-for-signin', 12),
      },
    })
    return user.id
  } catch (error) {
    console.error('Failed to get or create dev user:', error)
    throw new Error('Failed to initialize dev user. Please check database connection.')
  }
}
