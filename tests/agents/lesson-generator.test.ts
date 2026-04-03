import { describe, it, expect, beforeEach } from 'vitest'
import { generateLesson } from '@/lib/agents/lesson-generator'
import { prisma } from '@/lib/db'

describe('Lesson Generator', () => {
  let userId: string
  let mapId: string
  let taskId: string

  beforeEach(async () => {
    // 清理测试数据（按依赖顺序：子表先删）
    await prisma.learningLesson.deleteMany()
    await prisma.scheduledTask.deleteMany()
    await prisma.chatSession.deleteMany()
    // researchResult 和 growthRequest 表已删除
    // v2.5: 清理测试数据（Goal 已移除，Task 改名为 LearningTask）
    await prisma.learningTask.deleteMany()
    await prisma.growthStage.deleteMany()
    await prisma.growthMap.deleteMany()
    await prisma.userContextItem.deleteMany()
    await prisma.userProfile.deleteMany()
    await prisma.user.deleteMany()

    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: `test-lesson-${Date.now()}@example.com`,
        password: 'hashed',
        name: 'Test User',
        profile: {
          create: {
            currentLevel: 'beginner',
            interests: 'web development',
          },
        },
      },
    })
    userId = user.id

    // 创建测试地图和任务
    const map = await prisma.growthMap.create({
      data: {
        userId,
        title: 'Learn React',
        description: 'Master React fundamentals',
        status: 'confirmed',
        stages: {
          create: {
            stageOrder: 0,
            title: 'Foundation',
            description: 'Learn basics',
            durationWeeks: 4,
            goals: {
              create: {
                goalOrder: 0,
                title: 'Understand Components',
                description: 'Learn React components',
                tasks: {
                  create: {
                    taskOrder: 0,
                    title: 'Learn JSX Syntax',
                    description: 'Understand JSX and how to write React components',
                    type: 'learn',
                    durationDays: 3,
                  },
                },
              },
            },
          },
        },
      },
      include: {
        stages: {
          include: {
            goals: {
              include: {
                tasks: true,
              },
            },
          },
        },
      },
    })
    mapId = map.id
    taskId = map.stages[0].goals[0].tasks[0].id
  })

  it('should generate lesson for a task', async () => {
    const lesson = await generateLesson({
      taskId,
      userId,
    })

    expect(lesson).toBeDefined()
    expect(lesson.id).toBeDefined()
    expect(lesson.title).toBeTruthy()
    expect(lesson.contentMarkdown).toBeTruthy()
    expect(lesson.contentMarkdown.length).toBeGreaterThan(100)
    expect(lesson.taskId).toBe(taskId)
  }, 30000)

  it('should include sources in lesson', async () => {
    const lesson = await generateLesson({
      taskId,
      userId,
      includeResearch: true,
    })

    expect(lesson.sourcesJson).toBeTruthy()
    const sources = JSON.parse(lesson.sourcesJson!)
    expect(Array.isArray(sources)).toBe(true)
  }, 30000)

  it('should create lesson record in database', async () => {
    const lesson = await generateLesson({
      taskId,
      userId,
    })

    const dbLesson = await prisma.learningLesson.findUnique({
      where: { id: lesson.id },
    })

    expect(dbLesson).toBeDefined()
    expect(dbLesson!.taskId).toBe(taskId)
    expect(dbLesson!.status).toBe('published')
  }, 30000)

  it('should handle task not found', async () => {
    await expect(
      generateLesson({
        taskId: 'non-existent-id',
        userId,
      })
    ).rejects.toThrow()
  })
})
