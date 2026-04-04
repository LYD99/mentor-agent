import { auth } from '@/lib/auth'
import { buildContextPack } from '@/lib/agents/context-pack'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { ensureUserExists } from '@/lib/ensure-user'
import { chatDualWrite } from '@/lib/storage/chat-dual-write'
import { streamChat } from '@/lib/ai/stream-chat'
import { getLessonContent } from '@/lib/agents/lesson-generator'
import { advisorTools } from '@/lib/agents/tools/advisor-tools'
import { getEnv } from '@/lib/config/env-runtime'
import { getGrowthMapContext } from '@/lib/agents/growth-map-context'
import { buildAdvisorSystemPrompt } from '@/lib/prompts/advisor-prompts'
import { buildRagDatasetsPrompt } from '@/lib/services/rag-prompt-builder'
import { prisma } from '@/lib/db'

type IncomingPart = { type?: string; text?: string }
type IncomingMessage = {
  role: string
  content?: string
  parts?: IncomingPart[]
}

function textFromUserMessage(m: IncomingMessage): string {
  if (typeof m.content === 'string' && m.content.length > 0) return m.content
  if (m.parts?.length) {
    return m.parts
      .filter(
        (p): p is IncomingPart & { type: 'text'; text: string } =>
          p.type === 'text' && typeof p.text === 'string'
      )
      .map((p) => p.text)
      .join('')
  }
  return ''
}

function getLatestUserText(messages: IncomingMessage[]): string | undefined {
  const last = messages[messages.length - 1]
  if (last?.role === 'user') {
    const t = textFromUserMessage(last).trim()
    if (t) return t
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const t = textFromUserMessage(m).trim()
    if (t) return t
  }
  return undefined
}

export async function POST(req: Request) {
  const session = await auth()
  let userId = session?.user?.id
  
  if (!userId && process.env.NODE_ENV === 'development') {
    userId = await getOrCreateDevUserId()
  }
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  // 确保用户在数据库中存在（处理 OAuth 认证的情况）
  if (session?.user) {
    userId = await ensureUserExists({
      id: userId,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    })
  }

  const body = (await req.json()) as {
    messages?: IncomingMessage[]
    sessionId?: string
    lessonId?: string
    taskId?: string
    growthMapId?: string
    scheduleDate?: string
    dayTasks?: Array<{
      taskTitle: string
      learningObjectives?: string[]
      estimatedMinutes?: number
    }>
  }
  const { sessionId: sessionIdFromClient, lessonId, taskId, growthMapId, scheduleDate, dayTasks } = body
  const rawMessages = body.messages

  console.log('[Advisor API] Request params:', {
    lessonId,
    taskId,
    growthMapId,
    scheduleDate,
    dayTasksCount: dayTasks?.length,
    hasDayTasks: !!dayTasks,
    sessionId: sessionIdFromClient,
  })

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return new Response('Bad Request: messages required', { status: 400 })
  }

  const userMessage = getLatestUserText(rawMessages)
  if (!userMessage) {
    return new Response('Bad Request: empty user message', { status: 400 })
  }

  // 1. 加载讲义内容（如果提供了 lessonId）
  let lessonContent = ''
  let lessonTitle = ''
  let effectiveTaskId = taskId

  if (lessonId) {
    console.log('[Advisor API] Loading lesson content for lessonId:', lessonId)
    try {
      const lesson = await getLessonContent(lessonId)
      lessonTitle = lesson.title
      lessonContent = lesson.contentMarkdown
      console.log('[Advisor API] Lesson loaded:', {
        title: lessonTitle,
        contentLength: lessonContent.length,
      })
      // LearningMaterial 没有 taskId 字段
      effectiveTaskId = taskId
    } catch (error) {
      console.error('[Advisor] Failed to load lesson:', error)
      return new Response('Lesson not found', { status: 404 })
    }
  }

  // 2. 加载或创建会话
  let currentSessionId = sessionIdFromClient
  if (!currentSessionId) {
    const { sessionId: newId } = await chatDualWrite.createSession({
      userId,
      channel: 'advisor',
      title: lessonTitle || userMessage.slice(0, 50),
      lessonId,
      taskId: effectiveTaskId,
      growthMapId,
    })
    currentSessionId = newId
  }

  // 3. 写入用户消息（消息流模式）
  const { messageId: userMessageId } = await chatDualWrite.appendMessage({
    sessionId: currentSessionId,
    message: {
      role: 'user',
      content: userMessage,
    },
  })

  // 4. 加载上下文
  const contextPack = await buildContextPack(userId)
  const history = await chatDualWrite.loadMessages(currentSessionId)
  
  // 4.1 如果有关联的成长地图，加载地图内容
  let growthMapContext = ''
  let scheduleDateContext = ''
  if (growthMapId) {
    try {
      growthMapContext = await getGrowthMapContext(growthMapId)
      
      // 如果指定了 scheduleDate，从数据库加载完整的学习任务信息
      if (scheduleDate) {
        console.log(`[Advisor API] Loading complete task info from database for ${scheduleDate}`, {
          growthMapId,
          scheduleDate,
        })
        
        // v2.5: 从 DailyPlan 表加载学习计划，并关联 LearningTask 信息
        const dailyPlans = await prisma.dailyPlan.findMany({
          where: {
            mapId: growthMapId,
            planDate: new Date(scheduleDate),
          },
        })
        
        if (dailyPlans.length > 0) {
          // 查询所有关联的 LearningTask
          const taskIds = dailyPlans.map(p => p.taskId)
          const tasks = await prisma.learningTask.findMany({
            where: { id: { in: taskIds } },
            include: {
              stage: {
                select: {
                  title: true,
                  description: true,
                }
              }
            }
          })
          
          const taskMap = new Map(tasks.map(t => [t.id, t]))
          
          scheduleDateContext = `
📅 Target Learning Date: ${scheduleDate}

📚 Learning Tasks for This Day (${dailyPlans.length} tasks):
${dailyPlans.map((plan, i) => {
  const metadata = plan.metadata ? JSON.parse(plan.metadata) : {}
  const task = taskMap.get(plan.taskId)
  
  return `
${i + 1}. **${task?.title || 'Unknown Task'}**
   - Stage: ${task?.stage?.title || 'N/A'}
   - Description: ${task?.description || 'N/A'}
   - Type: ${task?.type || 'N/A'}
   - Learning Objectives: ${metadata.learningObjectives?.join(', ') || 'N/A'}
   - Suggested Duration: ${metadata.suggestedDuration || (task?.durationDays ? `${task.durationDays} days` : 'N/A')}
   - Difficulty: ${metadata.difficulty || 'N/A'}
   - Prerequisites: ${metadata.prerequisites?.join(', ') || 'N/A'}
   - Focus Areas: ${metadata.focusAreas?.join(', ') || 'N/A'}
`
}).join('\n')}

The user wants to generate detailed learning materials for the above tasks.
Please use the generate_lesson tool to create comprehensive learning materials.
`
        }
      }
    } catch (error) {
      console.error('[Advisor API] Failed to load growth map context:', error)
    }
  }

  // 5. 构造 messages
  const messages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const payload = m.message as any
      return {
        role: m.role,
        content: typeof payload.content === 'string' ? payload.content : '',
      }
    })

  // 6. 加载 RAG 知识库配置
  const ragDatasetsText = await buildRagDatasetsPrompt(userId)
  
  // 7. 构造 system prompt（使用统一的 prompts 模块）
  const systemPrompt = buildAdvisorSystemPrompt({
    contextPack,
    growthMapContext,
    scheduleDateContext,
    lessonTitle,
    lessonContent,
    hasTaskId: !!effectiveTaskId,
    ragDatasetsText,
  })

  // 8. 流式调用（带 Advisor 专用工具）- 使用消息流模式
  try {
    return await streamChat({
      systemPrompt,
      messages,
      tools: advisorTools,
      userId,
      sessionId: currentSessionId,
      messageId: userMessageId,
      responseHeaders: { 'X-Chat-Session-Id': currentSessionId },
      abortSignal: req.signal,
      toolContext: {
        userId,
        mapId: growthMapId,
        scheduleDate: scheduleDate,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stream failed'
    return new Response(msg, { status: 500 })
  }
}
