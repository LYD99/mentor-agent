import { prisma } from '@/lib/db'

/**
 * 获取学习资料内容
 * 统一从 LearningMaterial 表查询
 */
export async function getLessonContent(lessonId: string) {
  const material = await prisma.learningMaterial.findUnique({
    where: { id: lessonId },
  })

  if (!material) {
    throw new Error(`Lesson not found: ${lessonId}`)
  }

  // 返回标准格式
  return {
    id: material.id,
    title: material.title,
    contentMarkdown: material.contentMarkdown,
    contentJson: material.contentJson,
    userId: material.userId,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  }
}
