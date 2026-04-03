import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { chatDualWrite } from '@/lib/storage/chat-dual-write'
import { advisorTools } from '@/lib/agents/tools/advisor-tools'

describe('Advisor Integration', () => {
  let userId: string
  let mapId: string
  let taskId: string
  let lessonId: string

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
        email: `test-advisor-${Date.now()}@example.com`,
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
        status: 'learning',
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
                    status: 'in_progress',
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

    // 创建测试讲义
    const lesson = await prisma.learningLesson.create({
      data: {
        taskId,
        title: 'JSX Syntax Guide',
        contentMarkdown: `# JSX Syntax

JSX is a syntax extension for JavaScript that looks similar to HTML.

## Key Concepts

1. JSX elements
2. Props
3. Children

## Example

\`\`\`jsx
function Welcome(props) {
  return <h1>Hello, {props.name}</h1>
}
\`\`\`
`,
        sourcesJson: JSON.stringify(['https://react.dev/learn']),
        status: 'published',
        version: 1,
      },
    })
    lessonId = lesson.id
  })

  it('should create advisor session with lesson', async () => {
    const { sessionId } = await chatDualWrite.createSession({
      userId,
      channel: 'advisor',
      title: 'JSX Questions',
      lessonId,
      taskId,
    })

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    })

    expect(session).toBeDefined()
    expect(session!.channel).toBe('advisor')
    expect(session!.lessonId).toBe(lessonId)
    expect(session!.taskId).toBe(taskId)
  })

  it('should get task learning detail via tool', async () => {
    const tool = advisorTools.get_task_learning_detail

    const result = await (tool.execute as any)({ taskId, userId })

    expect(result).toBeDefined()
    expect(result.task).toBeDefined()
    expect(result.task?.id).toBe(taskId)
    expect(result.task?.title).toBe('Learn JSX Syntax')
    expect(result.task?.status).toBe('in_progress')
    expect(result.lesson).toBeDefined()
    expect(result.lesson!.id).toBe(lessonId)
    expect(result.summary).toContain('in_progress')
  })

  it('should list recent learning events', async () => {
    // 创建一个 advisor 会话作为学习事件
    const { sessionId } = await chatDualWrite.createSession({
      userId,
      channel: 'advisor',
      title: 'Study Session',
      taskId,
    })

    await chatDualWrite.appendMessage({
      sessionId,
      message: {
        role: 'user',
        content: 'What is JSX?',
      },
    })

    const tool = advisorTools.list_recent_learning_events

    const result = await (tool.execute as any)({ taskId, limit: 10, userId })

    expect(result).toBeDefined()
    expect(result.events).toBeDefined()
    expect(Array.isArray(result.events)).toBe(true)
    expect(result.events.length).toBeGreaterThan(0)
    expect(result.events[0].type).toBe('advisor_session')
  })

  it('should handle multiple advisor sessions for same task', async () => {
    // 创建多个会话
    const session1 = await chatDualWrite.createSession({
      userId,
      channel: 'advisor',
      title: 'Session 1',
      lessonId,
      taskId,
    })

    const session2 = await chatDualWrite.createSession({
      userId,
      channel: 'advisor',
      title: 'Session 2',
      lessonId,
      taskId,
    })

    await chatDualWrite.appendMessage({
      sessionId: session1.sessionId,
      message: {
        role: 'user',
        content: 'Question 1',
      },
    })

    await chatDualWrite.appendMessage({
      sessionId: session2.sessionId,
      message: {
        role: 'user',
        content: 'Question 2',
      },
    })

    // 获取学习详情应该显示两个会话
    const tool = advisorTools.get_task_learning_detail
    const result = await (tool.execute as any)({ taskId, userId })

    expect(result.recentSessions).toBeDefined()
    expect(result.recentSessions?.length).toBeGreaterThanOrEqual(2)
  })

  it('should prevent access to other users tasks', async () => {
    // 创建另一个用户
    const otherUser = await prisma.user.create({
      data: {
        email: `other-${Date.now()}@example.com`,
        password: 'hashed',
        name: 'Other User',
      },
    })

    const tool = advisorTools.get_task_learning_detail

    const result = await (tool.execute as any)({ taskId, userId: otherUser.id })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('not found or access denied')
  })
})
