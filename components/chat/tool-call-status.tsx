'use client'

import { useState, useEffect } from 'react'
import { Loader2, Search, Map, CheckCircle2, XCircle, Calendar, ChevronDown, ChevronRight, ExternalLink, BookOpen } from 'lucide-react'
import Link from 'next/link'

/**
 * 截断文本用于 UI 显示
 */
function truncateText(text: string | null | undefined, maxLength: number = 100): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * 截断对象中的长文本字段
 */
function truncateObjectFields(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj
  
  const truncated = { ...obj }
  const fieldsToTruncate = ['researchSummary', 'contextPack', 'mapContext', 'description', 'content']
  
  for (const field of fieldsToTruncate) {
    if (truncated[field] && typeof truncated[field] === 'string') {
      truncated[field] = truncateText(truncated[field], 150)
    }
  }
  
  return truncated
}

type ToolCallState = 'call' | 'partial-call' | 'result' | 'tool_result'

interface ToolInvocation {
  toolCallId: string
  toolName: string
  state: ToolCallState
  args?: any
  result?: any
}

const toolIcons: Record<string, any> = {
  create_growth_map: Map,
  create_growth_schedule: Calendar,
  search_web: Search,
  generate_lesson: BookOpen,
  list_recent_learning_events: Calendar,
}

const toolLabels: Record<string, string> = {
  create_growth_map: '生成学习地图',
  create_growth_schedule: '生成学习计划',
  search_web: '搜索学习资源',
  generate_lesson: '生成学习资料',
  list_recent_learning_events: '查询学习活动',
}

export function ToolCallStatus({ invocations }: { invocations: ToolInvocation[] }) {
  if (!invocations || invocations.length === 0) return null

  return (
    <div className="space-y-2 my-3">
      {invocations.map((inv) => {
        const Icon = toolIcons[inv.toolName] || Map
        const label = toolLabels[inv.toolName] || inv.toolName
        const isLoading = inv.state === 'call' || inv.state === 'partial-call'
        const isSuccess = (inv.state === 'result' || inv.state === 'tool_result') && inv.result?.success !== false
        const isError = (inv.state === 'result' || inv.state === 'tool_result') && inv.result?.success === false

        return (
          <ToolCallItem
            key={inv.toolCallId}
            invocation={inv}
            icon={Icon}
            label={label}
            isLoading={isLoading}
            isSuccess={isSuccess}
            isError={isError}
          />
        )
      })}
    </div>
  )
}

function ToolCallItem({
  invocation: inv,
  icon: Icon,
  label,
  isLoading,
  isSuccess,
  isError,
}: {
  invocation: ToolInvocation
  icon: any
  label: string
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
}) {
  const [showArgs, setShowArgs] = useState(false)
  const [stageProgress, setStageProgress] = useState<any[]>([])
  
  // 使用 SSE 实时接收进度更新（仅在加载中且是 create_growth_schedule 时）
  useEffect(() => {
    if (!isLoading || inv.toolName !== 'create_growth_schedule') {
      return
    }
    
    let eventSource: EventSource | null = null
    let retryTimeout: NodeJS.Timeout
    let retryCount = 0
    const MAX_RETRIES = 3
    
    const connectSSE = () => {
      try {
        // 建立 SSE 连接
        eventSource = new EventSource(`/api/tool-call/${inv.toolCallId}/stream`)
        
        eventSource.onopen = () => {
          retryCount = 0 // 重置重试计数
        }
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            if (data.type === 'stage_progress' && data.stageProgress) {
              // 直接替换整个数组，后端发送的是完整的状态数组
              setStageProgress([...data.stageProgress])
            } else if (data.type === 'completed' || data.type === 'failed') {
              // 工具执行完成，关闭连接
              eventSource?.close()
            }
          } catch (error) {
            console.error('[SSE] Failed to parse message:', error)
          }
        }
        
        eventSource.onerror = (error) => {
          console.error('[SSE] Connection error:', error)
          eventSource?.close()
          
          // 重试逻辑
          if (retryCount < MAX_RETRIES) {
            retryCount++
            console.log(`[SSE] Retrying connection (${retryCount}/${MAX_RETRIES})...`)
            retryTimeout = setTimeout(connectSSE, 2000 * retryCount)
          } else {
            console.error('[SSE] Max retries reached, giving up')
          }
        }
      } catch (error) {
        console.error('[SSE] Failed to create EventSource:', error)
      }
    }
    
    // 延迟 500ms 后建立连接（给后端时间创建记录）
    const initTimeout = setTimeout(connectSSE, 500)
    
    return () => {
      clearTimeout(initTimeout)
      if (retryTimeout) clearTimeout(retryTimeout)
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    }
  }, [isLoading, inv.toolCallId, inv.toolName])

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-muted/30 to-muted/10 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isLoading && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          )}
          {isSuccess && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
          )}
          {isError && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{label}</span>
            </div>
            
            {/* 参数展开按钮 */}
            {inv.args && Object.keys(inv.args).length > 0 && (
              <button
                onClick={() => setShowArgs(!showArgs)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showArgs ? (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>收起参数</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span>查看参数</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* 快速预览（针对特定参数） */}
          {!showArgs && inv.args?.goal && (
            <p className="text-xs text-muted-foreground mb-2 break-words">
              目标：{truncateText(inv.args.goal, 80)}
            </p>
          )}
          
          {!showArgs && inv.args?.researchSummary && (
            <p className="text-xs text-muted-foreground mb-2 break-words">
              研究：{truncateText(inv.args.researchSummary, 60)}
            </p>
          )}
          
          {!showArgs && inv.args?.mapId && !inv.args?.goal && (
            <p className="text-xs text-muted-foreground mb-2">
              地图 ID：{inv.args.mapId}
            </p>
          )}
          
          {!showArgs && inv.args?.query && (
            <p className="text-xs text-muted-foreground mb-2 break-words">
              搜索：{truncateText(inv.args.query, 80)}
            </p>
          )}

          {/* 完整参数展示 */}
          {showArgs && (
            <div className="mt-2 mb-3 rounded-lg bg-muted/50 p-3 text-xs font-mono">
              <div className="text-muted-foreground mb-1 font-sans font-medium">请求参数：</div>
              <pre className="whitespace-pre-wrap break-words text-foreground/80 max-h-60 overflow-y-auto">
                {JSON.stringify(truncateObjectFields(inv.args), null, 2)}
              </pre>
            </div>
          )}

          {isLoading && (
            <div className="mt-2 space-y-2">
              {/* 如果有阶段进度，显示详细进度 */}
              {stageProgress.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">生成进度：</div>
                  {stageProgress.map((stage, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <div className="flex-shrink-0">
                        {stage.status === 'completed' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        ) : stage.status === 'failed' ? (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        ) : stage.status === 'running' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />
                        )}
                      </div>
                      <span className={
                        stage.status === 'completed' ? 'text-green-700' : 
                        stage.status === 'failed' ? 'text-destructive' : 
                        stage.status === 'running' ? 'text-primary font-medium' :
                        'text-muted-foreground'
                      }>
                        阶段 {stage.stageIndex + 1}：{stage.stageTitle}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    正在处理中...
                  </p>
                </div>
              )}
            </div>
          )}

          {isSuccess && inv.result?.message && (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800 border border-green-200">
                {inv.result.message}
              </div>
              
              {/* 学习计划预览和跳转（仅针对 create_growth_schedule） */}
              {inv.toolName === 'create_growth_schedule' && inv.result?.mapId && inv.result?.schedule && (
                <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-base">学习计划概览</span>
                    </div>
                    <Link 
                      href={`/plan/${inv.result.mapId}?tab=schedule`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:text-primary/80 bg-background hover:bg-background/80 rounded-md border border-primary/20 transition-colors"
                    >
                      查看完整计划
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/50">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-xs">总天数</span>
                      </div>
                      <span className="text-xl font-bold text-primary">
                        {inv.result.schedule.totalDays || inv.result.schedule.studyReminders?.length || 0}
                      </span>
                      <span className="text-xs text-muted-foreground">天</span>
                    </div>
                    
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/50">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-xs">学习提醒</span>
                      </div>
                      <span className="text-xl font-bold text-green-600">
                        {inv.result.schedule.studyReminders?.length || 0}
                      </span>
                      <span className="text-xs text-muted-foreground">天</span>
                    </div>
                    
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-background/50">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5" />
                        <span className="text-xs">定时任务</span>
                      </div>
                      <span className="text-xl font-bold text-blue-600">
                        {inv.result.schedule.totalTasks || 0}
                      </span>
                      <span className="text-xs text-muted-foreground">个</span>
                    </div>
                  </div>
                  
                  {/* 前 3 天的简略预览 */}
                  {inv.result.schedule.studyReminders && inv.result.schedule.studyReminders.length > 0 && (
                    <div className="pt-3 border-t border-border/50">
                      <div className="text-xs font-medium text-muted-foreground mb-2">前 3 天预览：</div>
                      <div className="space-y-2">
                        {inv.result.schedule.studyReminders.slice(0, 3).map((day: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 text-sm p-2 rounded-md bg-background/50">
                            <span className="font-mono text-muted-foreground whitespace-nowrap">
                              {day.date}
                            </span>
                            <span className="text-foreground">
                              {day.tasks?.length || 0} 个任务
                            </span>
                            {day.tasks && day.tasks.length > 0 && (
                              <span className="text-xs text-muted-foreground truncate">
                                {day.tasks[0].taskTitle}
                                {day.tasks.length > 1 && ` 等 ${day.tasks.length} 项`}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 生成学习资料预览（仅针对 generate_lesson） */}
              {inv.toolName === 'generate_lesson' && inv.result?.success && inv.result?.summary && (
                <div className="rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50 via-indigo-50/80 to-purple-50/60 p-5 mt-3 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                      <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-base text-blue-900">学习资料已生成</div>
                      <div className="text-xs text-blue-600/70">内容已保存，可以开始学习了</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/80 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                      <span className="text-xs font-medium text-blue-600/70">关键知识点</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {inv.result.summary.keyPointsCount || 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/80 border border-green-100 shadow-sm hover:shadow-md transition-shadow">
                      <span className="text-xs font-medium text-green-600/70">练习题目</span>
                      <span className="text-2xl font-bold text-green-600">
                        {inv.result.summary.exercisesCount || 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/80 border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                      <span className="text-xs font-medium text-purple-600/70">学习资源</span>
                      <span className="text-2xl font-bold text-purple-600">
                        {inv.result.summary.resourcesCount || 0}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/80 border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
                      <span className="text-xs font-medium text-orange-600/70">内容长度</span>
                      <span className="text-2xl font-bold text-orange-600">
                        {Math.round((inv.result.summary.contentLength || 0) / 100) / 10}K
                      </span>
                    </div>
                  </div>
                  
                  {inv.result.summary.introduction && (
                    <div className="p-4 rounded-lg bg-white/90 border border-blue-200/60 shadow-sm">
                      <div className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">内容预览</div>
                      <div className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                        {inv.result.summary.introduction}
                      </div>
                    </div>
                  )}
                  
                  {(inv.result.lessonId || inv.result.materialId) && (
                    <Link 
                      href={`/materials/${inv.result.lessonId || inv.result.materialId}`}
                      className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all group"
                    >
                      <BookOpen className="h-4 w-4 group-hover:scale-110 transition-transform" />
                      <span>查看完整学习资料</span>
                      <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </Link>
                  )}
                </div>
              )}

              {/* 学习事件列表预览（仅针对 list_recent_learning_events） */}
              {inv.toolName === 'list_recent_learning_events' && inv.result?.events && inv.result.events.length > 0 && (
                <div className="rounded-xl border border-purple-200/60 bg-gradient-to-br from-purple-50 via-pink-50/80 to-fuchsia-50/60 p-5 mt-3 shadow-sm">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-md">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-base text-purple-900">最近学习活动</div>
                      <div className="text-xs text-purple-600/70">共 {inv.result.events.length} 条记录</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2.5">
                    {inv.result.events.slice(0, 5).map((event: any, idx: number) => {
                      const eventTypeConfig = {
                        'lesson_completed': { icon: '📚', label: '完成学习', color: 'text-blue-600 bg-blue-50 border-blue-200' },
                        'exercise_completed': { icon: '✅', label: '完成练习', color: 'text-green-600 bg-green-50 border-green-200' },
                        'task_started': { icon: '🚀', label: '开始任务', color: 'text-purple-600 bg-purple-50 border-purple-200' },
                        'material_created': { icon: '📝', label: '创建资料', color: 'text-orange-600 bg-orange-50 border-orange-200' },
                      }
                      const config = eventTypeConfig[event.eventType as keyof typeof eventTypeConfig] || { 
                        icon: '📌', 
                        label: event.eventType || '未知', 
                        color: 'text-gray-600 bg-gray-50 border-gray-200' 
                      }
                      
                      return (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white/90 border border-purple-100 shadow-sm hover:shadow-md transition-all">
                          <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                            <div className="text-xs font-semibold text-purple-900">
                              {event.timestamp ? new Date(event.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : 'N/A'}
                            </div>
                            <div className="text-[10px] text-purple-600/60 font-mono">
                              {event.timestamp ? new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 mb-1.5 line-clamp-1">
                              {event.taskTitle || event.lessonTitle || '未命名'}
                            </div>
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                              <span>{config.icon}</span>
                              <span>{config.label}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {inv.result.events.length > 5 && (
                      <div className="text-xs text-center text-purple-600/70 pt-2 font-medium">
                        + 还有 {inv.result.events.length - 5} 条活动记录
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isError && inv.result?.error && (
            <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive border border-destructive/20">
              {inv.result.error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
