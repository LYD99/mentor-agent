import { auth } from '@/lib/auth'
import { buildContextPack } from '@/lib/agents/context-pack'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { chatDualWrite } from '@/lib/storage/chat-dual-write'
import { streamChat } from '@/lib/ai/stream-chat'
import { getEnv } from '@/lib/config/env-runtime'
import { getGrowthMapContext } from '@/lib/agents/growth-map-context'
import { buildRagDatasetsPrompt } from '@/lib/services/rag-prompt-builder'

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
    console.log('[Mentor API] Using dev user:', userId)
  }
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  console.log('[Mentor API] User ID:', userId)

  const body = (await req.json()) as {
    messages?: IncomingMessage[]
    sessionId?: string
    growthMapId?: string
  }
  const { sessionId: sessionIdFromClient, growthMapId } = body
  const rawMessages = body.messages

  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return new Response('Bad Request: messages required', { status: 400 })
  }

  const userMessage = getLatestUserText(rawMessages)
  if (!userMessage) {
    return new Response('Bad Request: empty user message', { status: 400 })
  }

  // 1. 加载或创建会话
  let currentSessionId = sessionIdFromClient
  if (!currentSessionId) {
    const { sessionId: newId } = await chatDualWrite.createSession({
      userId,
      channel: 'mentor',
      title: userMessage.slice(0, 50),
      growthMapId,
    })
    currentSessionId = newId
  }

  // 2. 写入用户消息（消息流模式）
  const { messageId: userMessageId } = await chatDualWrite.appendMessage({
    sessionId: currentSessionId,
    message: {
      role: 'user',
      content: userMessage,
    },
  })
  
  // 3. 加载上下文
  const contextPack = await buildContextPack(userId)
  const history = await chatDualWrite.loadMessages(currentSessionId)
  
  // 3.1 如果有关联的成长地图，加载地图内容
  let growthMapContext = ''
  if (growthMapId) {
    try {
      growthMapContext = await getGrowthMapContext(growthMapId)
    } catch (error) {
      console.error('[Mentor API] Failed to load growth map context:', error)
    }
  }
  
  // 4. 构造 messages（仅 user/assistant，且 content 必须为 string）
  const messages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const payload = m.message as any
      return {
        role: m.role,
        content: typeof payload.content === 'string' ? payload.content : '',
      }
    })

  // 5. 流式调用（带 tools）
  try {
    const { createGrowthMapTool } = await import('@/lib/agents/tools/growth-map-tool')
    const { updateGrowthMapTool } = await import('@/lib/agents/tools/update-growth-map-tool')
    const { createGrowthScheduleTool } = await import('@/lib/agents/tools/create-growth-schedule-tool')
    const { researchTool } = await import('@/lib/agents/tools/research-tool')
    const { ragRetrieveTool } = await import('@/lib/agents/tools/rag-tools')
    const { buildMentorSystemPrompt } = await import('@/lib/prompts/mentor-prompts')
    
    // 加载 RAG 知识库配置
    const ragDatasetsText = await buildRagDatasetsPrompt(userId)
    
    // 使用提示词管理模块构建系统提示词
    const systemPrompt = buildMentorSystemPrompt({
      contextPack,
      growthMapContext,
      ragDatasetsText,
    })
    
    // 使用消息流模式（增量保存）
    return await streamChat({
      systemPrompt,
      messages,
      tools: {
        create_growth_map: createGrowthMapTool,
        update_growth_map: updateGrowthMapTool,
        create_growth_schedule: createGrowthScheduleTool,
        search_web: researchTool,
        rag_retrieve: ragRetrieveTool(),
      },
      userId,
      sessionId: currentSessionId,
      messageId: userMessageId,
      responseHeaders: { 'X-Chat-Session-Id': currentSessionId },
      abortSignal: req.signal,
      toolContext: {
        userId,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Stream failed'
    return new Response(msg, { status: 500 })
  }
}
