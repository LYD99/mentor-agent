import { describe, it, expect, beforeEach } from 'vitest'
import { chatDualWrite } from '@/lib/storage/chat-dual-write'
import { prisma } from '@/lib/db'
import { readJsonLines } from '@/lib/storage/jsonl-append'
import path from 'path'

/**
 * 消息流模式测试
 * 
 * 测试消息流模式的核心功能：
 * - 创建会话
 * - 追加各类消息（user, assistant text, assistant tool_calls, tool result）
 * - 加载消息流
 * - 验证数据一致性
 */
describe('Chat Dual Write - Message Stream Mode', () => {
  let testUserId: string
  let testSessionId: string

  beforeEach(async () => {
    // 清理测试数据 - 正确顺序避免外键约束
    await prisma.learningLesson.deleteMany()
    await prisma.chatSession.deleteMany()
    await prisma.scheduledTask.deleteMany()
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
        email: `test-chat-${Date.now()}@example.com`,
        password: 'hashed',
        name: 'Test User',
      },
    })
    testUserId = user.id
  })

  it('should create session', async () => {
    const result = await chatDualWrite.createSession({
      userId: testUserId,
      channel: 'mentor',
      title: 'Test Chat',
    })
    
    testSessionId = result.sessionId
    
    expect(result.sessionId).toBeDefined()
    expect(result.jsonlPath).toMatch(/sessions\/.*\.jsonl/)
    
    // 验证数据库
    const session = await prisma.chatSession.findUnique({
      where: { id: testSessionId },
    })
    expect(session).toBeDefined()
    expect(session!.messageCount).toBe(0)
  })

  it('should append user message', async () => {
    const { sessionId } = await chatDualWrite.createSession({
      userId: testUserId,
      channel: 'mentor',
    })
    
    // 追加用户消息（消息流格式）
    await chatDualWrite.appendMessage({
      sessionId,
      message: {
        role: 'user',
        content: 'Hello, mentor!',
      },
    })
    
    // 验证 SQLite（只检查元数据）
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    })
    expect(session!.messageCount).toBe(1)
    
    // 验证 JSONL
    const jsonlPath = path.join(
      process.cwd(),
      'data/local',
      session!.jsonlPath
    )
    const lines = await readJsonLines(jsonlPath)
    expect(lines).toHaveLength(1)
    expect(lines[0].role).toBe('user')
    expect(lines[0].payload.content).toBe('Hello, mentor!')
  })

  it('should append assistant text message', async () => {
    const { sessionId } = await chatDualWrite.createSession({
      userId: testUserId,
      channel: 'mentor',
    })
    
    await chatDualWrite.appendMessage({
      sessionId,
      message: {
        role: 'assistant',
        content: 'Hello! How can I help you today?',
      },
      model: 'gpt-4o-mini',
    })
    
    const messages = await chatDualWrite.loadMessages(sessionId)
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('assistant')
    expect((messages[0].message as any).content).toBe('Hello! How can I help you today?')
    expect(messages[0].model).toBe('gpt-4o-mini')
  })

  it('should append tool call and result messages', async () => {
    const { sessionId } = await chatDualWrite.createSession({
      userId: testUserId,
      channel: 'mentor',
    })
    
    // 工具调用消息
    await chatDualWrite.appendMessage({
      sessionId,
      message: {
        role: 'assistant',
        tool_calls: [{
          id: 'call_test_123',
          type: 'function',
          function: {
            name: 'search_web',
            arguments: JSON.stringify({ query: 'React tutorial' }),
          },
        }],
      },
    })
    
    // 工具结果消息
    await chatDualWrite.appendMessage({
      sessionId,
      message: {
        role: 'tool',
        tool_call_id: 'call_test_123',
        content: JSON.stringify({ success: true, results: [] }),
      },
    })
    
    const messages = await chatDualWrite.loadMessages(sessionId)
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('assistant')
    expect(messages[1].role).toBe('tool')
  })

  it('should maintain message order in stream', async () => {
    const { sessionId } = await chatDualWrite.createSession({
      userId: testUserId,
      channel: 'advisor',
    })
    
    // 模拟完整的消息流
    const messageSequence = [
      { role: 'user', content: 'Help me' },
      { role: 'assistant', content: 'Sure!' },
      { role: 'assistant', tool_calls: [{ id: 'c1', type: 'function' as const, function: { name: 't1', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: '{"ok":true}' },
      { role: 'assistant', content: 'Done!' },
    ]
    
    for (const msg of messageSequence) {
      await chatDualWrite.appendMessage({
        sessionId,
        message: msg as any,
      })
    }
    
    const loaded = await chatDualWrite.loadMessages(sessionId)
    expect(loaded).toHaveLength(5)
    
    // 验证顺序
    expect(loaded[0].role).toBe('user')
    expect(loaded[1].role).toBe('assistant')
    expect(loaded[2].role).toBe('assistant')
    expect(loaded[3].role).toBe('tool')
    expect(loaded[4].role).toBe('assistant')
  })

  it('should get session stats from JSONL', async () => {
    const { sessionId } = await chatDualWrite.createSession({
      userId: testUserId,
      channel: 'mentor',
    })
    
    // 添加多种类型的消息
    await chatDualWrite.appendMessage({
      sessionId,
      message: { role: 'user', content: 'Hi' },
    })
    
    await chatDualWrite.appendMessage({
      sessionId,
      message: { role: 'assistant', content: 'Hello' },
    })
    
    await chatDualWrite.appendMessage({
      sessionId,
      message: {
        role: 'assistant',
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 't1', arguments: '{}' } }],
      },
    })
    
    await chatDualWrite.appendMessage({
      sessionId,
      message: { role: 'tool', tool_call_id: 'c1', content: '{}' },
    })
    
    // 从 JSONL 加载消息并统计
    const messages = await chatDualWrite.loadMessages(sessionId)
    
    expect(messages.length).toBe(4)
    expect(messages.filter(m => m.role === 'user').length).toBe(1)
    expect(messages.filter(m => m.role === 'assistant').length).toBe(2)
    expect(messages.filter(m => m.role === 'tool').length).toBe(1)
  })

  it('should delete session and JSONL file', async () => {
    const { sessionId } = await chatDualWrite.createSession({
      userId: testUserId,
      channel: 'mentor',
    })
    
    await chatDualWrite.appendMessage({
      sessionId,
      message: { role: 'user', content: 'Test' },
    })
    
    // 删除会话
    await chatDualWrite.deleteSession(sessionId)
    
    // 验证数据库记录已删除
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    })
    expect(session).toBeNull()
  })

  it('should save and load messages with state field (v3)', async () => {
    const { sessionId } = await chatDualWrite.createSession({
      userId: testUserId,
      channel: 'mentor',
    })
    
    // 保存带 state 的工具调用消息
    await chatDualWrite.appendMessage({
      sessionId,
      message: {
        role: 'assistant',
        tool_calls: [{
          id: 'call_123',
          type: 'function',
          function: {
            name: 'search_web',
            arguments: JSON.stringify({ query: 'test' }),
          },
        }],
      },
      state: {
        type: 'tool_call',
        tool_call_id: 'call_123',
        tool_name: 'search_web',
        tool_status: 'pending',
      },
    })
    
    // 保存带 state 的工具结果消息
    await chatDualWrite.appendMessage({
      sessionId,
      message: {
        role: 'tool',
        tool_call_id: 'call_123',
        content: JSON.stringify({ success: true }),
      },
      state: {
        type: 'tool_result',
        tool_call_id: 'call_123',
        tool_name: 'search_web',
        tool_status: 'success',
        tool_duration_ms: 1234,
      },
    })
    
    // 加载消息并验证 state
    const messages = await chatDualWrite.loadMessages(sessionId)
    expect(messages).toHaveLength(2)
    
    // 验证工具调用的 state
    expect(messages[0].state).toBeDefined()
    expect(messages[0].state?.type).toBe('tool_call')
    expect(messages[0].state?.tool_name).toBe('search_web')
    expect(messages[0].state?.tool_status).toBe('pending')
    
    // 验证工具结果的 state
    expect(messages[1].state).toBeDefined()
    expect(messages[1].state?.type).toBe('tool_result')
    expect(messages[1].state?.tool_status).toBe('success')
    expect(messages[1].state?.tool_duration_ms).toBe(1234)
  })
})
