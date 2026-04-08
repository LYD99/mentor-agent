import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
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
