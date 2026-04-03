import { AdvisorChat } from '@/components/chat/advisor-chat'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export default async function AdvisorPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string; task?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id && process.env.NODE_ENV !== 'development') {
    redirect('/auth/signin')
  }

  const params = await searchParams
  let lessonId = params.lesson
  const taskId = params.task

  // v2.5: LearningMaterial 表没有 taskId 字段，无法通过 taskId 查找
  // 如果需要此功能，需要在 LearningMaterial 表添加 taskId 字段

  return <AdvisorChat lessonId={lessonId} taskId={taskId} />
}
