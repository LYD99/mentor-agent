/**
 * Chat Dual Write - 消息流模式 v3
 * 
 * 核心特性：
 * 1. 单一数据源：JSONL 文件是唯一的消息存储，数据库只存会话元数据
 * 2. 增量写入：每个消息片段立即写入 JSONL，不等待流式结束
 * 3. 消息流格式：user、assistant (text)、assistant (tool_calls)、tool (result) 独立保存
 * 4. 状态跟踪：新增 state 字段，记录工具调用状态、执行时长、错误信息
 * 
 * 消息格式示例：
 * {"role":"user","payload":{"role":"user","content":"帮我生成学习地图"},"state":{"type":"text"}}
 * {"role":"assistant","payload":{"role":"assistant","content":"好的..."},"state":{"type":"text"}}
 * {"role":"assistant","payload":{"role":"assistant","tool_calls":[...]},"state":{"type":"tool_call","tool_name":"create_growth_map","tool_status":"pending"}}
 * {"role":"tool","payload":{"role":"tool","tool_call_id":"xxx","content":"..."},"state":{"type":"tool_result","tool_status":"success","tool_duration_ms":1234}}
 */

import { prisma } from '@/lib/db'
import { appendJsonLine, hashLine } from './jsonl-append'
import path from 'path'
import { v4 as uuid } from 'uuid'
import { getEnv } from '@/lib/config/env-runtime'
import { readJsonLines } from './jsonl-append'

const getLocalDataDir = () => getEnv('LOCAL_DATA_DIR') || './data/local'

/**
 * 消息类型定义
 */
export interface UserMessage {
  role: 'user'
  content: string
}

export interface AssistantTextMessage {
  role: 'assistant'
  content: string
}

export interface AssistantToolCallMessage {
  role: 'assistant'
  tool_calls: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string // JSON string
    }
  }>
}

export interface ToolResultMessage {
  role: 'tool'
  tool_call_id: string
  content: string // JSON string
}

export type ChatMessage = 
  | UserMessage 
  | AssistantTextMessage 
  | AssistantToolCallMessage 
  | ToolResultMessage

/**
 * JSONL 存储格式
 */
interface JsonlMessage {
  id: string
  session_id: string
  seq: number
  role: 'user' | 'assistant' | 'tool'
  created_at: string
  channel: string
  payload: ChatMessage
  
  // 工具调用状态跟踪
  state?: {
    type: 'text' | 'tool_call' | 'tool_result'
    
    // 工具调用相关
    tool_call_id?: string
    tool_name?: string
    tool_status?: 'pending' | 'running' | 'success' | 'error'
    tool_duration_ms?: number
    tool_error?: string
  }
  
  usage?: {
    promptTokens: number
    completionTokens: number
  }
  model?: string
}

export const chatDualWrite = {
  /**
   * 创建会话
   */
  async createSession(params: {
    userId: string
    channel: 'mentor' | 'advisor' | 'system'
    title?: string
    growthMapId?: string
    lessonId?: string
    taskId?: string
  }) {
    const sessionId = uuid()
    const jsonlPath = `sessions/${sessionId}.jsonl`
    
    // 验证用户存在
    const userExists = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true }
    })
    
    if (!userExists) {
      throw new Error(`User with id ${params.userId} does not exist. Cannot create chat session.`)
    }
    
    const session = await prisma.chatSession.create({
      data: {
        id: sessionId,
        userId: params.userId,
        channel: params.channel,
        title: params.title,
        jsonlPath,
        growthMapId: params.growthMapId,
        lessonId: params.lessonId,
        taskId: params.taskId,
      },
    })
    
    return {
      sessionId: session.id,
      jsonlPath: session.jsonlPath,
    }
  },

  /**
   * 追加消息（消息流模式 v3）
   * 支持增量写入，每个消息片段立即保存到 JSONL
   * 数据库只更新会话元数据（messageCount、lastMessageAt）
   */
  async appendMessage(params: {
    sessionId: string
    message: ChatMessage
    state?: JsonlMessage['state']  // 工具调用状态
    usage?: { promptTokens: number; completionTokens: number }
    model?: string
  }) {
    const session = await prisma.chatSession.findUniqueOrThrow({
      where: { id: params.sessionId },
    })
    
    const seq = session.messageCount + 1
    const messageId = uuid()
    
    // 构造 JSONL 行数据
    const jsonlData: JsonlMessage = {
      id: messageId,
      session_id: params.sessionId,
      seq,
      role: params.message.role as 'user' | 'assistant' | 'tool',
      created_at: new Date().toISOString(),
      channel: session.channel,
      payload: params.message,
      state: params.state,  // 新增
      usage: params.usage,
      model: params.model,
    }
    
    // 1. 追加到 JSONL（立即写入）
    const jsonlFullPath = path.join(
      process.cwd(),
      getLocalDataDir(),
      session.jsonlPath
    )
    await appendJsonLine(jsonlFullPath, jsonlData)
    
    // 2. 只更新会话元数据（不再写入消息索引）
    await prisma.chatSession.update({
      where: { id: params.sessionId },
      data: {
        messageCount: seq,
        lastMessageAt: new Date(),
      },
    })
    
    return { messageId, seq }
  },


  /**
   * 加载消息（消息流模式 v3）
   * 直接从 JSONL 文件读取，支持 v2 和 v3 格式
   */
  async loadMessages(sessionId: string, options?: {
    limit?: number
    offset?: number
  }) {
    const session = await prisma.chatSession.findUniqueOrThrow({
      where: { id: sessionId },
    })
    
    const jsonlFullPath = path.join(
      process.cwd(),
      getLocalDataDir(),
      session.jsonlPath
    )
    
    // 从 JSONL 读取
    const lines = await readJsonLines(jsonlFullPath)
    
    // 应用分页
    const start = options?.offset || 0
    const end = options?.limit ? start + options.limit : lines.length
    const pagedLines = lines.slice(start, end)
    
    // 转换为统一格式（兼容 v2 和 v3）
    return pagedLines.map((line: JsonlMessage) => ({
      id: line.id,
      seq: line.seq,  // 保留 seq 用于排序
      role: line.role,
      message: line.payload,
      createdAt: line.created_at,
      state: 'state' in line ? line.state : undefined,  // v3 新增
      usage: line.usage,
      model: line.model,
    }))
  },

  /**
   * 删除会话（同时删除 JSONL 文件）
   * v2.4: 简化删除流程，不再需要删除消息索引
   */
  async deleteSession(sessionId: string) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    })
    
    if (!session) {
      throw new Error('Session not found')
    }
    
    // 删除 JSONL 文件
    const jsonlFullPath = path.join(
      process.cwd(),
      getLocalDataDir(),
      session.jsonlPath
    )
    
    try {
      const fs = await import('fs/promises')
      await fs.unlink(jsonlFullPath)
    } catch (error) {
      console.warn(`[ChatDualWrite] Failed to delete JSONL file: ${jsonlFullPath}`, error)
    }
    
    // 删除数据库记录
    await prisma.chatSession.delete({
      where: { id: sessionId },
    })
  },
}
