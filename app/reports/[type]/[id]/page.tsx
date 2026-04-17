'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ArrowLeft, Loader2, Home, Trash2, MessageCircleQuestion, Copy, Check, Edit, Save, ChevronDown, ChevronRight, Calendar, TrendingUp, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type ReportData = {
  id: string
  title: string
  type: string
  contentMarkdown: string
  createdAt: string
  category: 'daily' | 'weekly' | 'monthly'
  reportDate?: string
  weekStartDate?: string
  weekEndDate?: string
  year?: number
  month?: number
  mapId?: string | null
}

const categoryConfig = {
  daily: { label: '日报', icon: Calendar, color: 'text-blue-600' },
  weekly: { label: '周报', icon: TrendingUp, color: 'text-purple-600' },
  monthly: { label: '月报', icon: BarChart3, color: 'text-emerald-600' },
}

export default function ReportDetailPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const router = useRouter()
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [reportType, setReportType] = useState<string | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  
  // 编辑模式相关状态
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState({
    title: '',
    contentMarkdown: '',
  })
  
  // 文本选择相关状态
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  // 代码复制状态
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  
  // 代码块折叠状态
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    params.then(p => {
      setReportType(p.type)
      setReportId(p.id)
    })
  }, [params])

  useEffect(() => {
    if (reportType && reportId) {
      loadReport()
    }
  }, [reportType, reportId])

  const loadReport = async () => {
    if (!reportType || !reportId) return
    
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/${reportType}/${reportId}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setReport(data.report)
        
        // 初始化编辑数据
        setEditData({
          title: data.report.title,
          contentMarkdown: data.report.contentMarkdown,
        })
      } else {
        const data = await res.json()
        setError(data.error || '加载失败')
      }
    } catch (err) {
      console.error('Failed to load report:', err)
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!report || !reportType || !reportId) return
    
    if (!confirm(`确定要删除${categoryConfig[report.category].label}「${report.title}」吗？\n\n此操作无法恢复。`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/reports/${reportType}/${reportId}/delete`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/materials')
      } else {
        const result = await response.json()
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete report error:', error)
      alert('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // 进入编辑模式
  const handleEdit = () => {
    if (report) {
      setEditData({
        title: report.title,
        contentMarkdown: report.contentMarkdown,
      })
      setIsEditing(true)
    }
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false)
    if (report) {
      setEditData({
        title: report.title,
        contentMarkdown: report.contentMarkdown,
      })
    }
  }

  // 保存编辑
  const handleSave = async () => {
    if (!reportType || !reportId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/reports/${reportType}/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: editData.title,
          contentMarkdown: editData.contentMarkdown,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setReport(data.report)
        setIsEditing(false)
        await loadReport()
      } else {
        const result = await response.json()
        alert(`保存失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Save report error:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 复制代码到剪贴板
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  // 跳转到 Advisor 并提问
  const handleAskAdvisor = () => {
    if (!selectedText || !reportId) return
    
    const question = `关于${report?.category === 'daily' ? '日报' : report?.category === 'weekly' ? '周报' : '月报'}中的这段内容，我有疑问：\n\n「${selectedText}」\n\n请帮我解释一下。`
    
    const params = new URLSearchParams({
      message: question,
    })
    
    window.open(`/advisor?${params.toString()}`, '_blank', 'noopener,noreferrer')
    
    setSelectedText('')
    setSelectionPosition(null)
  }

  // 监听文本选择事件
  useEffect(() => {
    const contentElement = contentRef.current
    if (!contentElement) return
    
    const handleSelection = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim()
      
      if (text && text.length > 0) {
        setSelectedText(text)
        
        const range = selection?.getRangeAt(0)
        const rect = range?.getBoundingClientRect()
        
        if (rect) {
          setSelectionPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
          })
        }
      } else {
        setSelectedText('')
        setSelectionPosition(null)
      }
    }
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      if (target.closest('[data-ask-advisor-button]')) {
        return
      }
      
      if (contentElement.contains(target)) {
        return
      }
      
      setSelectedText('')
      setSelectionPosition(null)
    }
    
    contentElement.addEventListener('mouseup', handleSelection)
    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      contentElement.removeEventListener('mouseup', handleSelection)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [report])

  const getDateDisplay = () => {
    if (!report) return ''
    
    if (report.reportDate) {
      return new Date(report.reportDate).toLocaleDateString('zh-CN')
    }
    if (report.weekStartDate && report.weekEndDate) {
      return `${new Date(report.weekStartDate).toLocaleDateString('zh-CN')} - ${new Date(report.weekEndDate).toLocaleDateString('zh-CN')}`
    }
    if (report.year && report.month) {
      return `${report.year}年${report.month}月`
    }
    return new Date(report.createdAt).toLocaleDateString('zh-CN')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">加载中...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">{error || '报告不存在'}</p>
            <Link href="/materials" className="mt-4 inline-block">
              <Button variant="outline">返回资料列表</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const config = categoryConfig[report.category]
  const Icon = config.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Link href="/materials">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                返回资料列表
              </Button>
            </Link>
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEdit}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleting ? '删除中...' : '删除'}
                  </Button>
                  <Link href="/">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Home className="h-4 w-4" />
                      返回首页
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              首页
            </Link>
            <span>/</span>
            <Link href="/materials" className="hover:text-foreground transition-colors">
              学习资料
            </Link>
            <span>/</span>
            <span className="text-foreground">{config.label}</span>
          </div>

          {/* Title */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex-shrink-0">
              <Icon className={`h-6 w-6 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              {!isEditing ? (
                <h1 className="text-3xl font-bold mb-2">{report.title}</h1>
              ) : (
                <Input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="text-3xl font-bold border-2 mb-2"
                  placeholder="输入标题"
                  disabled={saving}
                />
              )}
              
              {/* Meta Info */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">类型：</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    report.category === 'daily' ? 'bg-blue-100 text-blue-700' :
                    report.category === 'weekly' ? 'bg-purple-100 text-purple-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">日期：</span>
                  <span>{getDateDisplay()}</span>
                </div>
              </div>
              
              <div className="mt-2 text-xs text-muted-foreground">
                创建时间：{new Date(report.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-lg border border-border bg-card p-6 sm:p-8 relative">
          {!isEditing ? (
            <div 
              ref={contentRef}
              className="prose prose-sm sm:prose-base max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    const codeString = String(children).replace(/\n$/, '')
                    const language = match ? match[1] : ''
                    
                    if (!inline && language) {
                      const codeId = `${language}_${codeString.substring(0, 50)}`
                      const isCollapsed = collapsedCodeBlocks[codeId] || false
                      
                      return (
                        <div className="relative group my-4">
                          <div className="flex items-center justify-between bg-zinc-800 text-zinc-100 px-4 py-2 rounded-t-lg border border-zinc-700">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setCollapsedCodeBlocks(prev => ({
                                    ...prev,
                                    [codeId]: !isCollapsed
                                  }))
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-zinc-700 transition-colors"
                                title={isCollapsed ? "展开代码" : "折叠代码"}
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="h-3 w-3" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </button>
                              <span className="text-xs font-medium uppercase">{language}</span>
                              {isCollapsed && (
                                <span className="text-xs text-zinc-400">
                                  ({codeString.split('\n').length} 行)
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleCopyCode(codeString)}
                              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-zinc-700 transition-colors"
                              title="复制代码"
                            >
                              {copiedCode === codeString ? (
                                <>
                                  <Check className="h-3 w-3" />
                                  已复制
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  复制
                                </>
                              )}
                            </button>
                          </div>
                          {!isCollapsed && (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={language}
                              PreTag="div"
                              className="!mt-0 !rounded-t-none !rounded-b-lg !border !border-t-0 !border-zinc-700"
                              customStyle={{
                                margin: 0,
                                padding: '1rem',
                                fontSize: '0.875rem',
                                lineHeight: '1.5',
                              }}
                              {...props}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                          )}
                        </div>
                      )
                    } else {
                      return (
                        <code
                          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-rose-600 dark:text-rose-400 text-sm font-mono border border-zinc-200 dark:border-zinc-700"
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    }
                  },
                }}
              >
                {report.contentMarkdown}
              </ReactMarkdown>
            </div>
          ) : (
            <div>
              <Textarea
                value={editData.contentMarkdown}
                onChange={(e) => setEditData({ ...editData, contentMarkdown: e.target.value })}
                className="min-h-[500px] font-mono text-sm"
                placeholder="输入 Markdown 内容"
                disabled={saving}
              />
            </div>
          )}
          
          {/* 文本选择后的浮动按钮 */}
          {selectedText && selectionPosition && (
            <div
              data-ask-advisor-button
              className="fixed z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
              style={{
                left: `${selectionPosition.x}px`,
                top: `${selectionPosition.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <Button
                size="sm"
                className="gap-2 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleAskAdvisor()
                }}
              >
                <MessageCircleQuestion className="h-4 w-4" />
                向 Advisor 提问
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
