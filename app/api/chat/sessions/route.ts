import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { ensureUserExists } from '@/lib/ensure-user'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const session = await auth()
  let userId = session?.user?.id
  
  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // 确保用户在数据库中存在
  if (session?.user) {
    userId = await ensureUserExists({
      id: userId,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    })
  }

  const url = new URL(req.url)
  const channel = url.searchParams.get('channel') ?? undefined

  const sessions = await prisma.chatSession.findMany({
    where: {
      userId,
      ...(channel ? { channel } : {}),
    },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    take: 80,
    select: {
      id: true,
      title: true,
      channel: true,
      messageCount: true,
      lastMessageAt: true,
      createdAt: true,
    },
  })

  return Response.json({ sessions })
}
