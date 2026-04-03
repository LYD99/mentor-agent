'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, MessageSquare, Loader2, Home, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// v2.5: LearningTask 直接属于 Stage，Goal 已移除
type LessonData = {
  id: string
  title: string
  contentMarkdown: string
  createdAt: string
  task: {
    id: string
    title: string
    stage: {
      title: string
      map: {
        id: string
        title: string
      }
    }
  }
}

export default function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lessonId, setLessonId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    params.then(p => {
      setLessonId(p.id)
    })
  }, [params])

  useEffect(() => {
    if (lessonId) {
      loadLesson()
    }
  }, [lessonId])

  const loadLesson = async () => {
    if (!lessonId) return
    
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lesson/${lessonId}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setLesson(data.lesson)
      } else {
        const data = await res.json()
        setError(data.error || '加载失败')
      }
    } catch (err) {
      console.error('Failed to load lesson:', err)
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAskQuestion = () => {
    if (lessonId) {
      router.push(`/advisor?lesson=${lessonId}`)
    }
  }

  const handleDelete = async () => {
    if (!lesson || !lessonId) return
    
    if (!confirm(`确定要删除讲义「${lesson.title}」吗？\n\n此操作无法恢复。`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/lesson/${lessonId}/delete`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/materials')
      } else {
        const result = await response.json()
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete lesson error:', error)
      alert('删除失败')
    } finally {
      setDeleting(false)
    }
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

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">{error || '讲义不存在'}</p>
            <Link href="/materials" className="mt-4 inline-block">
              <Button variant="outline">返回资料列表</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
              <Button
                onClick={handleAskQuestion}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                向 Advisor 提问
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
            <Link 
              href={`/plan/${lesson.task.stage.map.id}`}
              className="hover:text-foreground transition-colors"
            >
              {lesson.task.stage.map.title}
            </Link>
            <span>/</span>
            <span className="text-foreground">讲义详情</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
          
          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium">阶段：</span>
              <span>{lesson.task.stage.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">任务：</span>
              <span>{lesson.task.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">任务：</span>
              <span>{lesson.task.title}</span>
            </div>
          </div>
          
          <div className="mt-2 text-xs text-muted-foreground">
            创建时间：{new Date(lesson.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>

        {/* Content */}
        <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
          <div className="prose prose-sm sm:prose-base max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline prose-code:text-foreground prose-pre:bg-muted prose-pre:border prose-pre:border-border">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {lesson.contentMarkdown}
            </ReactMarkdown>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleAskQuestion}
            size="lg"
            className="gap-2"
          >
            <MessageSquare className="h-5 w-5" />
            对这份讲义有疑问？向 Advisor 提问
          </Button>
        </div>
      </div>
    </div>
  )
}
