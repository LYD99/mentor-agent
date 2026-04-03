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
import { Loader2, MessageSquarePlus, PanelLeftClose, PanelLeft, User, LogOut, Home, Bot, BookOpen, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToolCallStatus } from './tool-call-status'
import { LearningResourceSelector } from './learning-resource-selector'
import { cn } from '@/lib/utils'

type ResourceType = 'lesson' | 'schedule'

type LessonResource = {
  type: 'lesson'
  id: string
  title: string
  taskTitle?: string
  date?: string
}

type ScheduleResource = {
  type: 'schedule'
  mapId: string
  mapTitle: string
  totalDays: number
  totalTasks: number
  scheduleDate?: string // 可选：具体某天的日期
  dayTasks?: Array<{   // 可选：该天的任务列表
    taskTitle: string
    learningObjectives?: string[]
    estimatedMinutes?: number
  }>
}

type Resource = LessonResource | ScheduleResource

type SessionRow = {
  id: string
  title: string | null
  channel: string
  messageCount: number
  lastMessageAt: string | null
  createdAt: string
}

type MessagePart = 
  | { type: 'text'; text: string }
  | { 
      type: 'tool-invocation'
      toolCallId: string
      toolName: string
      args: any
      state: 'call' | 'result' | 'partial-call'
      result?: any
    }

function parseMessageParts(m: Message): MessagePart[] {
  const parts: MessagePart[] = []
  
  // 如果有 parts 属性，使用它（流式输出的顺序）
  if (m.parts && Array.isArray(m.parts) && m.parts.length > 0) {
    for (const part of m.parts) {
      const partType = (part as any).type
      
      if (partType === 'text' && (part as any).text) {
        parts.push({ type: 'text', text: (part as any).text })
      } else if (partType === 'tool-invocation') {
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
    return parts
  }
  
  // 回退：如果没有 parts，从 content 和 toolInvocations 构建
  if (typeof m.content === 'string' && m.content) {
    parts.push({ type: 'text', text: m.content })
  }
  
  if (m.toolInvocations && Array.isArray(m.toolInvocations)) {
    for (const inv of m.toolInvocations) {
      const invAny = inv as any
      parts.push({
        type: 'tool-invocation',
        toolCallId: invAny.toolCallId,
        toolName: invAny.toolName,
        args: invAny.args,
        state: invAny.state || (invAny.result !== undefined ? 'result' : 'call'),
        result: invAny.result,
      })
    }
  }
  
  return parts
}

type AdvisorChatProps = {
  lessonId?: string
  taskId?: string
}

export function AdvisorChat({ lessonId, taskId }: AdvisorChatProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionFromUrl = searchParams.get('session') ?? undefined
  const scheduleDateFromUrl = searchParams.get('scheduleDate') ?? undefined
  const mapIdFromUrl = searchParams.get('mapId') ?? undefined
  const messageFromUrl = searchParams.get('message') ?? undefined

  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(
    sessionFromUrl
  )
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [listOpen, setListOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [userInfo, setUserInfo] = useState<{ name?: string; email?: string } | null>(null)
  const [lessonContent, setLessonContent] = useState<string | null>(null)
  const [lessonTitle, setLessonTitle] = useState<string | null>(null)
  const [selectedResource, setSelectedResource] = useState<Resource | undefined>()
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [shouldAutoLoadSession, setShouldAutoLoadSession] = useState(true)
  
  // 标记是否从特殊页面跳转过来
  const isSpecialNavigation = useRef(Boolean(lessonId || taskId || scheduleDateFromUrl))
  
  // 存储从 URL 加载的 schedule 数据，用于初始消息
  const initialScheduleData = useRef<{
    mapId?: string
    scheduleDate?: string
    dayTasks?: Array<{
      taskTitle: string
      learningObjectives?: string[]
      estimatedMinutes?: number
    }>
  } | undefined>(undefined)

  const refreshSessions = useCallback(async () => {
    const res = await fetch('/api/chat/sessions?channel=advisor', {
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
    if (shouldAutoLoadSession && !sessionFromUrl && !lessonId && !taskId && sessions.length > 0 && !activeSessionId) {
      // 获取最近的会话
      const latestSession = sessions[0]
      if (latestSession) {
        setActiveSessionId(latestSession.id)
        router.replace(`/advisor?session=${latestSession.id}`, { scroll: false })
      }
    }
  }, [shouldAutoLoadSession, sessionFromUrl, lessonId, taskId, sessions, activeSessionId, router])

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

  // 加载讲义内容
  useEffect(() => {
    async function loadLesson() {
      if (!lessonId) {
        setLessonContent(null)
        setLessonTitle(null)
        return
      }
      try {
        const res = await fetch(`/api/lesson/${lessonId}`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setLessonContent(data.lesson?.contentMarkdown || null)
          setLessonTitle(data.lesson?.title || null)
        }
      } catch (err) {
        console.error('Failed to load lesson:', err)
      }
    }
    void loadLesson()
  }, [lessonId])

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, stop, append } =
    useChat({
      api: '/api/agent/advisor',
      body: { 
        sessionId: activeSessionId,
        lessonId: lessonId || (selectedResource?.type === 'lesson' ? selectedResource.id : undefined),
        taskId,
        // 优先使用 ref 中的数据（用于初始消息），否则使用 selectedResource
        growthMapId: initialScheduleData.current?.mapId || (selectedResource?.type === 'schedule' ? selectedResource.mapId : undefined),
        scheduleDate: initialScheduleData.current?.scheduleDate || (selectedResource?.type === 'schedule' ? selectedResource.scheduleDate : undefined),
        dayTasks: initialScheduleData.current?.dayTasks || (selectedResource?.type === 'schedule' ? selectedResource.dayTasks : undefined),
      },
      credentials: 'include',
      onResponse: (response) => {
        const sid = response.headers.get('x-chat-session-id')
        if (sid) {
          setActiveSessionId(sid)
          const params = new URLSearchParams()
          params.set('session', sid)
          if (lessonId) params.set('lesson', lessonId)
          if (taskId) params.set('task', taskId)
          router.replace(`/advisor?${params.toString()}`, { scroll: false })
          void refreshSessions()
        }
      },
    })

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

  // 处理从学习资料页面跳转过来的初始消息（文本选择提问）
  const lastProcessedLessonMessage = useRef<string | null>(null)
  useEffect(() => {
    console.log('[Advisor] useEffect triggered with:', {
      messageFromUrl: messageFromUrl?.slice(0, 30),
      lessonId,
      scheduleDateFromUrl,
      hasMessage: !!messageFromUrl,
      hasLesson: !!lessonId,
      hasSchedule: !!scheduleDateFromUrl,
    })
    
    // 处理从学习资料页面选择文字后跳转过来的情况
    // 条件：有 message 和 lessonId（通过 props 传入），但没有 scheduleDate
    if (messageFromUrl && lessonId && !scheduleDateFromUrl) {
      const messageKey = `${lessonId}:${messageFromUrl}`
      
      // 避免重复处理相同的消息
      if (messageKey === lastProcessedLessonMessage.current) {
        console.log('[Advisor] Skipping duplicate message')
        return
      }
      
      lastProcessedLessonMessage.current = messageKey
      
      console.log('[Advisor] Processing text selection question from material:', {
        lessonId,
        messagePreview: messageFromUrl.slice(0, 50),
      })
      
      // 创建新会话
      console.log('[Advisor] Creating new session for text selection question')
      setShouldAutoLoadSession(false)
      setActiveSessionId(undefined)
      setMessages([])
      
      // 加载学习资料信息并设置为 selectedResource
      const loadLessonInfo = async () => {
        try {
          const res = await fetch(`/api/materials/${lessonId}`)
          if (res.ok) {
            const data = await res.json()
            const material = data.material
            
            console.log('[Advisor] Loaded lesson info:', {
              id: material.id,
              title: material.title,
            })
            
            // 设置为选中的资源
            setSelectedResource({
              type: 'lesson',
              id: material.id,
              title: material.title,
              taskTitle: material.taskId ? '关联任务' : undefined,
              date: new Date(material.createdAt).toLocaleDateString('zh-CN'),
            })
          }
        } catch (error) {
          console.error('[Advisor] Failed to load lesson info:', error)
        }
      }
      
      void loadLessonInfo()
      
      // 立即清除 URL 参数
      router.replace('/advisor', { scroll: false })
      
      // 发送消息（lessonId 已经通过 useChat 的 body 传递）
      requestAnimationFrame(() => {
        console.log('[Advisor] Appending initial message')
        void append({
          role: 'user',
          content: messageFromUrl,
        })
      })
    }
  }, [messageFromUrl, lessonId, scheduleDateFromUrl, append, router])

  // 处理从学习计划页面跳转过来的初始消息
  // 使用 scheduleDate 作为 key，每次日期变化都会重新处理
  const lastProcessedScheduleDate = useRef<string | null>(null)
  useEffect(() => {
    // 只有当 scheduleDate 变化时才处理（避免重复处理同一个日期）
    if (messageFromUrl && scheduleDateFromUrl && mapIdFromUrl && 
        scheduleDateFromUrl !== lastProcessedScheduleDate.current) {
      lastProcessedScheduleDate.current = scheduleDateFromUrl

      // 重要：创建新会话，清空当前会话和消息
      console.log('[Advisor] Creating new session for schedule date:', scheduleDateFromUrl)
      setShouldAutoLoadSession(false)
      setActiveSessionId(undefined)
      setMessages([])
      setSelectedResource(undefined)

      // 立即清除 URL 参数，避免 URL 闪烁
      router.replace('/advisor', { scroll: false })

      // 加载该日期的学习计划数据，构建 selectedResource
      const loadScheduleData = async () => {
        try {
          const res = await fetch(`/api/growth-map/${mapIdFromUrl}`)
          if (!res.ok) {
            console.error('[Advisor] Failed to load growth map')
            return
          }
          const data = await res.json()
          
          if (data.learningPlanJson) {
            const plan = JSON.parse(data.learningPlanJson)
            const totalDays = plan.dailySchedule?.length || 0
            const totalTasks = plan.dailySchedule?.reduce((sum: number, day: any) => {
              return sum + (day.tasks?.length || 0)
            }, 0) || 0

            // 查找具体某天的学习任务
            const daySchedule = plan.dailySchedule?.find((d: any) => d.date === scheduleDateFromUrl)
            const dayTasks = daySchedule?.tasks?.map((t: any) => ({
              taskTitle: t.taskTitle,
              learningObjectives: t.learningObjectives || (t.learningContent ? [t.learningContent] : []),
              estimatedMinutes: t.estimatedMinutes || t.suggestedDuration,
            })) || []

            console.log(`[Advisor] Loaded schedule for ${scheduleDateFromUrl}:`, {
              dayFound: !!daySchedule,
              tasksCount: dayTasks.length,
            })

            // 存储到 ref 中，供初始消息使用
            initialScheduleData.current = {
              mapId: mapIdFromUrl,
              scheduleDate: scheduleDateFromUrl,
              dayTasks,
            }

            // 设置选中的资源为该地图的学习计划（包含具体某天的信息）
            setSelectedResource({
              type: 'schedule',
              mapId: mapIdFromUrl,
              mapTitle: data.title,
              totalDays,
              totalTasks,
              scheduleDate: scheduleDateFromUrl, // 具体日期
              dayTasks, // 该天的任务
            })

            // 数据加载完成后立即发送消息（使用 requestAnimationFrame 确保 state 已更新）
            requestAnimationFrame(() => {
              console.log('[Advisor] Sending initial message with data:', {
                mapId: initialScheduleData.current?.mapId,
                scheduleDate: initialScheduleData.current?.scheduleDate,
                dayTasksCount: initialScheduleData.current?.dayTasks?.length,
              })
              void append(
                {
                  role: 'user',
                  content: messageFromUrl,
                },
                {
                  body: {
                    growthMapId: initialScheduleData.current?.mapId,
                    scheduleDate: initialScheduleData.current?.scheduleDate,
                    dayTasks: initialScheduleData.current?.dayTasks,
                  }
                }
              )
            })
          }
        } catch (error) {
          console.error('[Advisor] Error loading schedule data:', error)
        }
      }

      // 启动数据加载
      void loadScheduleData()
    }
  }, [messageFromUrl, scheduleDateFromUrl, mapIdFromUrl, append, router])

  function startNewChat() {
    setShouldAutoLoadSession(false) // 禁用自动加载
    setActiveSessionId(undefined)
    setMessages([])
    setSelectedResource(undefined)
    const params = new URLSearchParams()
    if (lessonId) params.set('lesson', lessonId)
    if (taskId) params.set('task', taskId)
    router.replace(`/advisor${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })
  }

  function openSession(id: string) {
    if (isLoading) return
    setActiveSessionId(id)
    const params = new URLSearchParams()
    params.set('session', id)
    if (lessonId) params.set('lesson', lessonId)
    if (taskId) params.set('task', taskId)
    router.replace(`/advisor?${params.toString()}`, { scroll: false })
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
                        <BookOpen className={cn(
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
          aria-controls="advisor-session-panel"
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
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Advisor</h1>
          {lessonTitle && (
            <span className="text-sm text-muted-foreground">
              · {lessonTitle}
            </span>
          )}
        </div>

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
          id="advisor-session-panel"
          className={cn(
            'absolute inset-y-0 left-0 z-40 w-80 border-r border-border bg-background transition-transform duration-300',
            'top-14',
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

          {/* 讲义内容提示 */}
          {lessonContent && messages.length === 0 && (
            <div className="border-b border-border bg-blue-50/50 px-4 py-3">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-start gap-2 text-sm">
                  <BookOpen className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-900 mb-1">
                      已加载讲义：{lessonTitle}
                    </p>
                    <p className="text-blue-700">
                      您可以就讲义内容向 Advisor 提问，获得深入的解释和讨论。
                    </p>
                  </div>
                </div>
              </div>
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
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white">
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
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {part.text}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              )
                            } else if (part.type === 'tool-invocation') {
                              return (
                                <div key={`tool-${idx}`}>
                                  <ToolCallStatus
                                    invocations={[{
                                      toolCallId: part.toolCallId,
                                      toolName: part.toolName,
                                      args: part.args,
                                      state: part.state as any,
                                      result: part.result,
                                    } as any]}
                                  />
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
              <LearningResourceSelector
                selectedResource={selectedResource}
                onSelect={setSelectedResource}
                disabled={isLoading || historyLoading}
              />
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="向 Advisor 提问…"
                  disabled={isLoading || historyLoading}
                  className="flex-1"
                />
                {isLoading ? (
                  <Button 
                    type="button" 
                    onClick={stop}
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
