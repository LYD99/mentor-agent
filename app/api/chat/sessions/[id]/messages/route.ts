import { auth } from '@/lib/auth'
import { getOrCreateDevUserId } from '@/lib/dev-user'
import { ensureUserExists } from '@/lib/ensure-user'
import { prisma } from '@/lib/db'
import { chatDualWrite } from '@/lib/storage/chat-dual-write'

/**
 * GET /api/chat/sessions/[id]/messages
 * 
 * 加载会话的消息流（v2.0 消息流模式）
 * 
 * 消息流格式：
 * - user: 用户消息
 * - assistant (text): AI 文本回复
 * - assistant (tool_calls): AI 工具调用
 * - tool: 工具执行结果
 */
export async function GET(
  _req: Request,
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
  
  // 确保用户在数据库中存在
  if (session?.user) {
    userId = await ensureUserExists({
      id: userId,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    })
  }

  const { id } = await params

  const chat = await prisma.chatSession.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!chat || chat.userId !== userId) {
    return new Response('Not found', { status: 404 })
  }

  // 加载消息流
  const messageStream = await chatDualWrite.loadMessages(id)
  
  // 提取所有 create_growth_map 工具调用的 mapId
  const mapIds = new Set<string>()
  for (const msg of messageStream) {
    const payload = msg.message as any
    if (payload.role === 'tool') {
      try {
        const result = JSON.parse(payload.content)
        if (result.mapId) {
          mapIds.add(result.mapId)
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }
  
  // 批量查询地图的当前状态
  const mapStatuses = new Map<string, string>()
  if (mapIds.size > 0) {
    const maps = await prisma.growthMap.findMany({
      where: { id: { in: Array.from(mapIds) } },
      select: { id: true, status: true },
    })
    for (const map of maps) {
      mapStatuses.set(map.id, map.status)
    }
  }
  
  // 转换为前端格式（兼容 AI SDK 的 Message 格式）
  // 第一步：按 seq 分组，同一个 seq 内先处理 tool_calls 再处理 tool 结果
  const messagesBySeq = new Map<number, typeof messageStream>()
  for (const msg of messageStream) {
    const seq = msg.seq
    if (!messagesBySeq.has(seq)) {
      messagesBySeq.set(seq, [])
    }
    messagesBySeq.get(seq)!.push(msg)
  }
  
  // 第二步：对每个 seq 内的消息排序，确保 tool_calls 在 tool 结果之前
  for (const [seq, msgs] of messagesBySeq.entries()) {
    msgs.sort((a, b) => {
      const aPayload = a.message as any
      const bPayload = b.message as any
      
      // user 消息优先级最高
      if (aPayload.role === 'user') return -1
      if (bPayload.role === 'user') return 1
      
      // assistant 的 tool_calls 必须在 tool 结果之前
      if (aPayload.role === 'assistant' && aPayload.tool_calls) return -1
      if (bPayload.role === 'assistant' && bPayload.tool_calls) return 1
      if (aPayload.role === 'tool') return 1
      if (bPayload.role === 'tool') return -1
      
      return 0
    })
  }
  
  // 第三步：按 seq 顺序重新组装消息列表
  const sortedSeqs = Array.from(messagesBySeq.keys()).sort((a, b) => a - b)
  const sortedMessages = sortedSeqs.flatMap(seq => messagesBySeq.get(seq)!)
  
  // 将消息流合并为前端可渲染的格式
  const messages: any[] = []
  let currentAssistantMessage: any = null
  
  for (const msg of sortedMessages) {
    const payload = msg.message as any
    
    if (payload.role === 'user') {
      // 用户消息：直接添加
      messages.push({
        id: msg.id,
        role: 'user',
        content: payload.content,
        createdAt: msg.createdAt,
      })
      currentAssistantMessage = null
      
    } else if (payload.role === 'assistant') {
      if (payload.content) {
        // Assistant 文本消息
        if (currentAssistantMessage && currentAssistantMessage.role === 'assistant') {
          // 合并到当前 assistant 消息
          currentAssistantMessage.content += payload.content
          currentAssistantMessage.parts.push({
            type: 'text',
            text: payload.content,
          })
        } else {
          // 创建新的 assistant 消息
          currentAssistantMessage = {
            id: msg.id,
            role: 'assistant',
            content: payload.content,
            parts: [{
              type: 'text',
              text: payload.content,
            }],
            createdAt: msg.createdAt,
          }
          messages.push(currentAssistantMessage)
        }
      } else if (payload.tool_calls) {
        // Assistant 工具调用消息
        if (!currentAssistantMessage || currentAssistantMessage.role !== 'assistant') {
          currentAssistantMessage = {
            id: msg.id,
            role: 'assistant',
            content: '',
            parts: [],
            createdAt: msg.createdAt,
          }
          messages.push(currentAssistantMessage)
        }
        
        // 添加工具调用（等待结果）
        for (const toolCall of payload.tool_calls) {
          currentAssistantMessage.parts.push({
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: toolCall.id,
              toolName: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments),
              state: 'call', // 初始状态
            },
          })
        }
      }
      
    } else if (payload.role === 'tool') {
      // Tool 结果消息：找到对应的工具调用并更新
      const toolCallId = payload.tool_call_id
      
      // 从 JSONL 的 state 中获取工具执行状态
      const msgState = (msg as any).state
      const toolStatus = msgState?.tool_status || 'success' // 默认成功
      
      if (currentAssistantMessage && currentAssistantMessage.parts) {
        for (const part of currentAssistantMessage.parts) {
          if (part.type === 'tool-invocation' && 
              part.toolInvocation.toolCallId === toolCallId) {
            // 根据 tool_status 设置状态：success -> result, error -> result (通过 result.success 区分)
            part.toolInvocation.state = 'result'
            
            try {
              const result = JSON.parse(payload.content)
              
              // 注入 tool_status 信息到 result 中
              if (toolStatus === 'error' && result.success !== false) {
                result.success = false
              }
              
              // 如果是 create_growth_map，注入实时状态
              if (part.toolInvocation.toolName === 'create_growth_map' && 
                  result.success && 
                  result.mapId) {
                const currentStatus = mapStatuses.get(result.mapId)
                if (currentStatus) {
                  result.currentStatus = currentStatus
                }
              }
              
              part.toolInvocation.result = result
            } catch (e) {
              part.toolInvocation.result = { error: 'Failed to parse result', success: false }
            }
            break
          }
        }
      }
    }
  }

  return Response.json({ messages })
}
