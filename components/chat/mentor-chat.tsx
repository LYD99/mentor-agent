'use client'

import type { Message } from 'ai'
import { useChat } from 'ai/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Loader2, MessageSquarePlus, PanelLeftClose, PanelLeft, User, LogOut, Settings, MessageSquare, Home, Bot, Trash2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GrowthMapTree } from './growth-map-tree'
import { ToolCallStatus } from './tool-call-status'
import { GrowthMapSelector } from './growth-map-selector'
import { cn } from '@/lib/utils'

type SessionRow = {
  id: string
  title: string | null
  channel: string
  messageCount: number
  lastMessageAt: string | null
  createdAt: string
}

// 按照流式输出顺序解析消息内容
type MessagePart = 
  | { type: 'text'; text: string }
  | { type: 'tool-invocation'; toolCallId: string; toolName: string; args: any; state: string; result?: any }

function parseMessageParts(m: Message): MessagePart[] {
  const parts: MessagePart[] = []
  
  // 调试：打印消息结构
  if (m.role === 'assistant') {
    console.log('[MentorChat] Parsing assistant message:', {
      id: m.id,
      hasParts: Boolean(m.parts),
      partsLength: m.parts?.length,
      hasToolInvocations: Boolean(m.toolInvocations),
      toolInvocationsLength: m.toolInvocations?.length,
      content: typeof m.content === 'string' ? m.content.substring(0, 50) : m.content,
    })
  }
  
  // 如果有 parts 属性，使用它（流式输出的顺序）
  if (m.parts && Array.isArray(m.parts) && m.parts.length > 0) {
    for (const part of m.parts) {
      const partType = (part as any).type
      
      if (partType === 'text' && (part as any).text) {
        parts.push({ type: 'text', text: (part as any).text })
      } else if (partType === 'tool-invocation') {
        // 工具调用：数据在 toolInvocation 字段里
        const toolInvocation = (part as any).toolInvocation
        parts.push({
          type: 'tool-invocation',
          toolCallId: toolInvocation.toolCallId,
          toolName: toolInvocation.toolName,
          args: toolInvocation.args,
          state: toolInvocation.state || (toolInvocation.result !== undefined ? 'result' : 'call'),
          result: toolInvocation.result,
        })
      }
    }
    // 如果有 parts，就不再处理 toolInvocations（避免重复）
    return parts
  }
  
  // 回退：如果没有 parts，从 content 和 toolInvocations 构建
  // 注意：在当前实现中，后端 API 总是返回 parts 格式，
  // 这个回退逻辑主要用于兼容 Vercel AI SDK 的原始格式（防御性编程）
  // 实际运行时：历史消息加载不会执行此逻辑，流式响应中可能会用到
  if (typeof m.content === 'string' && m.content) {
    parts.push({ type: 'text', text: m.content })
  }
  
  // 从 toolInvocations 添加工具调用
  if (m.toolInvocations && Array.isArray(m.toolInvocations)) {
    for (const inv of m.toolInvocations) {
      const invAny = inv as any
      parts.push({
        type: 'tool-invocation',
        toolCallId: inv.toolCallId,
        toolName: inv.toolName,
        args: inv.args,
        state: invAny.state || 'call',
        result: invAny.result,
      })
    }
  }
  
  return parts
}

export function MentorChat() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionFromUrl = searchParams.get('session') ?? undefined
  const mapIdFromUrl = searchParams.get('mapId') ?? undefined
  const messageFromUrl = searchParams.get('message') ?? undefined

  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    sessionFromUrl
  )
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [listOpen, setListOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [userInfo, setUserInfo] = useState<{ name?: string; email?: string } | null>(null)
  const [selectedGrowthMapId, setSelectedGrowthMapId] = useState<string | undefined>(mapIdFromUrl)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [approvingMapId, setApprovingMapId] = useState<string | null>(null)
  const [approvedMaps, setApprovedMaps] = useState<Set<string>>(new Set())
  // 维护地图状态的本地缓存，用于实时更新 UI
  const [mapStatusCache, setMapStatusCache] = useState<Record<string, string>>({})
  const [shouldAutoLoadSession, setShouldAutoLoadSession] = useState(true)
  
  // 标记是否从特殊页面跳转过来（地图详情等），如果是则不自动加载历史会话
  const isSpecialNavigation = useRef(Boolean(mapIdFromUrl || messageFromUrl))

  const refreshSessions = useCallback(async () => {
    const res = await fetch('/api/chat/sessions?channel=mentor', {
      credentials: 'include',
    })
    if (!res.ok) return
    const data = (await res.json()) as { sessions: SessionRow[] }
    setSessions(data.sessions ?? [])
  }, [])

  useEffect(() => {
    setActiveSessionId(sessionFromUrl)
  }, [sessionFromUrl])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  // 自动加载最近一次会话（仅当没有指定 session 且不是从特殊页面跳转过来时）
  useEffect(() => {
    if (shouldAutoLoadSession && !sessionFromUrl && !isSpecialNavigation.current && sessions.length > 0 && !activeSessionId) {
      // 获取最近的会话
      const latestSession = sessions[0]
      if (latestSession) {
        setActiveSessionId(latestSession.id)
        router.replace(`/mentor?session=${latestSession.id}`, { scroll: false })
      }
    }
  }, [shouldAutoLoadSession, sessionFromUrl, sessions, activeSessionId, router])

  useEffect(() => {
    // 获取用户信息
    async function fetchUserInfo() {
      try {
        const res = await fetch('/api/user/me', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setUserInfo(data.user)
        }
      } catch (err) {
        console.error('Failed to fetch user info:', err)
      }
    }
    void fetchUserInfo()
  }, [])

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, stop, append } =
    useChat({
      api: '/api/agent/mentor',
      body: { 
        sessionId: activeSessionId,
        growthMapId: selectedGrowthMapId,
      },
      credentials: 'include',
      onResponse: (response) => {
        const sid = response.headers.get('x-chat-session-id')
        // 只在 session ID 发生变化时才更新（避免工具调用时重复刷新）
        if (sid && sid !== activeSessionId) {
          setActiveSessionId(sid)
          router.replace(`/mentor?session=${sid}`, { scroll: false })
          void refreshSessions()
        }
      },
    })

  // 处理从 URL 传入的初始消息（用于从地图详情页跳转过来）
  // 使用 useRef 来确保只执行一次
  const initialMessageHandled = useRef(false)
  
  useEffect(() => {
    if (messageFromUrl && mapIdFromUrl && !initialMessageHandled.current) {
      initialMessageHandled.current = true
      
      // 设置地图 ID
      setSelectedGrowthMapId(mapIdFromUrl)
      
      // 清除 URL 参数
      router.replace('/mentor', { scroll: false })
      
      // 延迟发送消息，确保 selectedGrowthMapId 已更新到 useChat 的 body
      setTimeout(() => {
        void append({
          role: 'user',
          content: messageFromUrl,
        })
      }, 100)
    }
  }, [messageFromUrl, mapIdFromUrl, append, router])

  // 自定义中断处理
  const handleStop = useCallback(() => {
    stop()
    
    // 立即更新 UI，将所有进行中的工具调用标记为已中断
    setMessages((prevMessages) => {
      return prevMessages.map((msg) => {
        if (msg.role !== 'assistant') return msg
        
        let updated = false
        const newMsg = { ...msg }
        
        // 更新 parts
        if (msg.parts && Array.isArray(msg.parts)) {
          newMsg.parts = msg.parts.map((part: any) => {
            if (part.type === 'tool-invocation' && part.toolInvocation) {
              const state = part.toolInvocation.state
              if (state === 'call' || state === 'partial-call') {
                updated = true
                return {
                  ...part,
                  toolInvocation: {
                    ...part.toolInvocation,
                    state: 'result',
                    result: {
                      success: false,
                      error: '用户已中断操作',
                    },
                  },
                }
              }
            }
            return part
          })
        }
        
        // 更新 toolInvocations（回退兼容）
        if (msg.toolInvocations && Array.isArray(msg.toolInvocations)) {
          newMsg.toolInvocations = msg.toolInvocations.map((inv: any) => {
            if (inv.state === 'call' || inv.state === 'partial-call') {
              updated = true
              return {
                ...inv,
                state: 'result',
                result: {
                  success: false,
                  error: '用户已中断操作',
                },
              }
            }
            return inv
          })
        }
        
        return updated ? newMsg : msg
      })
    })
  }, [stop, setMessages])

  useEffect(() => {
    let cancelled = false
    async function loadHistory() {
      if (!activeSessionId) {
        setMessages([])
        setHistoryLoading(false)
        return
      }
      setHistoryLoading(true)
      try {
        const res = await fetch(`/api/chat/sessions/${activeSessionId}/messages`, {
          credentials: 'include',
        })
        if (!res.ok) {
          if (!cancelled) setMessages([])
          return
        }
        const data = (await res.json()) as { messages: Message[] }
        if (!cancelled) setMessages(data.messages ?? [])
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    void loadHistory()
    return () => {
      cancelled = true
    }
  }, [activeSessionId, setMessages])

  function startNewChat() {
    setShouldAutoLoadSession(false) // 禁用自动加载
    setActiveSessionId(undefined)
    setMessages([])
    setSelectedGrowthMapId(undefined)
    router.replace('/mentor', { scroll: false })
  }

  function openSession(id: string) {
    if (isLoading) return
    setActiveSessionId(id)
    router.replace(`/mentor?session=${id}`, { scroll: false })
  }

  const handleApproveMap = async (mapId: string) => {
    // 检查是否已经接受过
    if (approvedMaps.has(mapId)) {
      alert('此地图已经接受过了')
      return
    }

    setApprovingMapId(mapId)
    try {
      // 第一步：接受地图（状态变为 pending_plan）
      const approveResponse = await fetch(`/api/growth-map/${mapId}/approve`, {
        method: 'POST',
      })

      if (!approveResponse.ok) {
        const result = await approveResponse.json()
        alert(`接受失败: ${result.error}`)
        return
      }

      const approveResult = await approveResponse.json()
      setApprovedMaps(prev => new Set(prev).add(mapId))
      
      // 更新地图状态缓存，立即反映到 UI
      setMapStatusCache(prev => ({
        ...prev,
        [mapId]: approveResult.map.status || 'pending_plan'
      }))
      
      // 第二步：在聊天界面发送"请生成学习计划"消息
      // 直接请求生成，不需要 AI 询问确认
      if (activeSessionId) {
        const userMessage = `我已接受地图「${approveResult.map.title}」（ID: ${mapId}），请为我生成详细的学习计划。`
        
        // 使用 append 函数发送用户消息并触发 Agent 响应
        await append({
          role: 'user',
          content: userMessage,
        })
      } else {
        // 如果没有当前会话，提示用户
        alert('地图已接受！请在聊天中询问 Mentor Agent 生成学习计划。')
      }

    } catch (error) {
      console.error('Approve map error:', error)
      alert('操作失败，请重试')
    } finally {
      setApprovingMapId(null)
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string, sessionTitle: string | null) => {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm(`确定要删除会话「${sessionTitle || '未命名会话'}」吗？\n\n此操作无法恢复。`)) {
      return
    }

    setDeletingSessionId(sessionId)
    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/delete`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // 如果删除的是当前会话，清空当前会话
        if (sessionId === activeSessionId) {
          startNewChat()
        }
        await refreshSessions()
      } else {
        const result = await response.json()
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete session error:', error)
      alert('删除失败')
    } finally {
      setDeletingSessionId(null)
    }
  }

  const sessionList = (
    <div className="flex h-full flex-col bg-muted/30">
      {/* 会话列表 */}
      <nav className="flex-1 overflow-y-auto p-3" aria-label="会话列表">
        {sessions.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquarePlus className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              暂无历史会话
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => {
              const active = s.id === activeSessionId
              const label = s.title?.trim() || '未命名会话'
              const when = s.lastMessageAt
                ? formatDistanceToNow(new Date(s.lastMessageAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })
                : formatDistanceToNow(new Date(s.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })
              return (
                <li key={s.id}>
                  <div className="relative group/item">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => openSession(s.id)}
                      className={cn(
                        'relative w-full rounded-lg px-3 py-2.5 text-left transition-all',
                        active
                          ? 'bg-primary/10 text-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare className={cn(
                          "h-4 w-4 mt-0.5 flex-shrink-0",
                          active ? "text-primary" : "text-muted-foreground/60"
                        )} />
                        <div className="flex-1 min-w-0 pr-8">
                          <p className={cn(
                            "text-sm line-clamp-2 mb-1",
                            active ? "font-medium" : ""
                          )}>
                            {label}
                          </p>
                          <p className="text-xs text-muted-foreground/80">
                            {when}
                          </p>
                        </div>
                      </div>
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(e, s.id, s.title)}
                      disabled={deletingSessionId === s.id}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover/item:opacity-100"
                      title="删除会话"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      {/* 用户信息区域 */}
      <div className="border-t border-border/50 p-3">
        {userInfo ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {userInfo.name || '用户'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userInfo.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/api/auth/signout'
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中...
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* 顶部栏 */}
      <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
        {/* 展开/收起按钮 */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setListOpen((o) => !o)}
          aria-expanded={listOpen}
          aria-controls="mentor-session-panel"
          className="h-9 w-9 p-0"
        >
          {listOpen ? (
            <PanelLeftClose className="h-5 w-5" aria-hidden />
          ) : (
            <PanelLeft className="h-5 w-5" aria-hidden />
          )}
          <span className="sr-only">切换会话列表</span>
        </Button>

        {/* 标题 */}
        <h1 className="text-lg font-semibold">Mentor</h1>

        {/* 右侧操作区 */}
        <div className="ml-auto flex items-center gap-2">
          <Link href="/">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">返回首页</span>
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => startNewChat()}
            disabled={isLoading}
            className="gap-2"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span className="hidden sm:inline">新建对话</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <div
          id="mentor-session-panel"
          className={cn(
            'absolute inset-y-0 left-0 z-40 w-80 border-r border-border bg-background transition-transform duration-300',
            'top-14', // 从顶部栏下方开始
            listOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sessionList}
        </div>

        {/* 遮罩层 */}
        {listOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
            style={{ top: '3.5rem' }}
            onClick={() => setListOpen(false)}
          />
        )}

        {/* 主内容区 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {historyLoading && (
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              正在加载会话…
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {error && (
              <div
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error.message}
              </div>
            )}
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((m) => {
                const isUser = m.role === 'user'
                const parts = parseMessageParts(m)

                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex gap-3',
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    )}
                  >
                    {/* 头像 */}
                    <div className="flex-shrink-0">
                      {isUser ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <User className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* 消息内容 */}
                    <div className={cn('flex-1 space-y-2', isUser ? 'flex flex-col items-end' : '')}>
                      {isUser ? (
                        <div className="inline-block rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground">
                          <p className="text-sm whitespace-pre-wrap">
                            {parts.find(p => p.type === 'text')?.text || '\u00a0'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* 按照流式输出的实际顺序渲染 */}
                          {parts.map((part, idx) => {
                            if (part.type === 'text') {
                              return (
                                <div key={`text-${idx}`} className="rounded-2xl bg-muted/50 px-4 py-3">
                                  <div className="prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        a: ({ href, children, ...props }) => {
                                          if (href?.startsWith('/plan/')) {
                                            return (
                                              <Link
                                                href={href}
                                                className="font-medium text-primary hover:underline"
                                                {...props}
                                              >
                                                {children}
                                              </Link>
                                            )
                                          }
                                          return (
                                            <a href={href} {...props}>
                                              {children}
                                            </a>
                                          )
                                        },
                                      }}
                                    >
                                      {part.text}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )
                            } else if (part.type === 'tool-invocation') {
                              // 渲染工具调用（包含状态和结果）
                              return (
                                <div key={`tool-${idx}`} className="space-y-2">
                                  {/* 工具调用状态 */}
                                  <ToolCallStatus
                                    invocations={[{
                                      toolCallId: part.toolCallId,
                                      toolName: part.toolName,
                                      args: part.args,
                                      state: part.state as any,
                                      result: part.result,
                                    } as any]}
                                  />
                                  
                                  {/* 如果是 create_growth_map 且有结果，渲染成长地图 */}
                                  {part.toolName === 'create_growth_map' && 
                                   part.state === 'result' && 
                                   part.result?.success && 
                                   part.result?.mapId && (() => {
                                     const mapId = part.result.mapId
                                     // 优先使用缓存中的状态，如果没有则使用原始状态
                                     const currentStatus = mapStatusCache[mapId] || part.result.currentStatus || part.result.status
                                     
                                     return (
                                       <GrowthMapTree
                                         data={{
                                           mapId,
                                           title: part.result.title,
                                           description: part.result.description,
                                           stages: part.result.stages || [],
                                           status: currentStatus,
                                         }}
                                         showStatus={true}
                                         showApproval={currentStatus === 'draft' && !approvedMaps.has(mapId)}
                                         onApprove={() => handleApproveMap(mapId)}
                                       />
                                     )
                                   })()}
                                </div>
                              )
                            }
                            return null
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="border-t border-border bg-background p-4">
            <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-2">
              <GrowthMapSelector
                selectedMapId={selectedGrowthMapId}
                onSelect={setSelectedGrowthMapId}
                disabled={isLoading || historyLoading}
              />
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="向 Mentor 提问…"
                  disabled={isLoading || historyLoading}
                  className="flex-1"
                />
                {isLoading ? (
                  <Button 
                    type="button" 
                    onClick={handleStop}
                    variant="destructive"
                  >
                    中断
                  </Button>
                ) : (
                  <Button type="submit" disabled={historyLoading}>
                    发送
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
