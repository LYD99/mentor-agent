import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { getLessonContent } from '@/lib/agents/lesson-generator'
import { NextRequest } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  let userId = session?.user?.id
  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id: lessonId } = await params

  try {
    const lesson = await getLessonContent(lessonId)

    // 验证用户权限
    if (lesson.userId !== userId) {
      return new Response('Forbidden', { status: 403 })
    }

    return Response.json({ lesson })
  } catch (error) {
    console.error('[Lessons API] Error:', error)
    return new Response('Lesson not found', { status: 404 })
  }
}
