'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ArrowLeft, Loader2, Home, Trash2, MessageCircleQuestion, Copy, Check, ZoomIn, X, Edit, Save, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/materials/markdown-editor'

type MaterialData = {
  id: string
  title: string
  type: string
  contentMarkdown: string
  contentJson: string | null
  source: string | null
  createdAt: string
  mapId: string | null
  taskId: string | null
}

export default function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [material, setMaterial] = useState<MaterialData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [materialId, setMaterialId] = useState<string | null>(null)
  
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
  
  // 图片预览状态
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  
  // 图片数据映射（从 metadata 中解析）
  const [imageMap, setImageMap] = useState<Record<string, string>>({})
  
  // 代码块折叠状态(codeString -> boolean)
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    params.then(p => {
      setMaterialId(p.id)
    })
  }, [params])

  useEffect(() => {
    if (materialId) {
      loadMaterial()
    }
  }, [materialId])

  const loadMaterial = async () => {
    if (!materialId) return
    
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setMaterial(data.material)
        
        // 初始化编辑数据
        setEditData({
          title: data.material.title,
          contentMarkdown: data.material.contentMarkdown,
        })
        
        // 解析 contentJson 中的图片数据
        if (data.material.contentJson) {
          try {
            const contentData = JSON.parse(data.material.contentJson)
            if (contentData.metadata?.images) {
              console.log('[Material] Found images in metadata:', Object.keys(contentData.metadata.images).length)
              setImageMap(contentData.metadata.images)
            }
          } catch (e) {
            console.error('[Material] Failed to parse contentJson:', e)
          }
        }
      } else {
        const data = await res.json()
        setError(data.error || '加载失败')
      }
    } catch (err) {
      console.error('Failed to load material:', err)
      setError('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!material || !materialId) return
    
    if (!confirm(`确定要删除资料「${material.title}」吗？\n\n此操作无法恢复。`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/materials/${materialId}/delete`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.push('/materials')
      } else {
        const result = await response.json()
        alert(`删除失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete material error:', error)
      alert('删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // 进入编辑模式
  const handleEdit = () => {
    if (material) {
      setEditData({
        title: material.title,
        contentMarkdown: material.contentMarkdown,
      })
      setIsEditing(true)
    }
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false)
    if (material) {
      setEditData({
        title: material.title,
        contentMarkdown: material.contentMarkdown,
      })
    }
  }

  // 从 Markdown 中提取实际使用的图片 ID
  const extractUsedImageIds = (markdown: string): string[] => {
    const imageRegex = /!\[.*?\]\((image_[a-z0-9_]+)\)/g
    const matches = markdown.matchAll(imageRegex)
    const ids: string[] = []
    
    for (const match of matches) {
      ids.push(match[1])
    }
    
    return ids
  }

  // 保存编辑
  const handleSave = async () => {
    if (!materialId) return

    setSaving(true)
    try {
      // 提取 Markdown 中实际使用的图片 ID
      const usedImageIds = extractUsedImageIds(editData.contentMarkdown)
      
      // 只保留实际使用的图片数据
      const cleanedImageMap: Record<string, string> = {}
      usedImageIds.forEach(id => {
        if (imageMap[id]) {
          cleanedImageMap[id] = imageMap[id]
        }
      })
      
      console.log('[Material] Cleaning images:', {
        total: Object.keys(imageMap).length,
        used: Object.keys(cleanedImageMap).length,
        removed: Object.keys(imageMap).length - Object.keys(cleanedImageMap).length
      })
      
      // 构建 contentJson，只包含使用的图片映射
      const contentJson = JSON.stringify({
        metadata: {
          images: cleanedImageMap,
        },
        updatedAt: new Date().toISOString(),
      })

      const response = await fetch(`/api/materials/${materialId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: editData.title,
          contentMarkdown: editData.contentMarkdown,
          contentJson,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setMaterial(data.material)
        setIsEditing(false)
        // 重新加载以获取最新数据
        await loadMaterial()
      } else {
        const result = await response.json()
        alert(`保存失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Save material error:', error)
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

  // 跳转到 Advisor 并提问（新窗口）
  const handleAskAdvisor = () => {
    console.log('[Material] Ask advisor clicked:', { selectedText, materialId })
    
    if (!selectedText || !materialId) {
      console.error('[Material] Missing data:', { selectedText: !!selectedText, materialId: !!materialId })
      return
    }
    
    // 构造问题文本
    const question = `关于学习资料中的这段内容，我有疑问：\n\n「${selectedText}」\n\n请帮我解释一下。`
    
    // 在新窗口打开 advisor 页面，携带 lesson 参数（注意是 lesson 不是 lessonId）和 message
    const params = new URLSearchParams({
      lesson: materialId,
      message: question,
    })
    
    const advisorUrl = `/advisor?${params.toString()}`
    console.log('[Material] Opening advisor in new window:', advisorUrl)
    
    // 使用 window.open 在新窗口打开
    window.open(advisorUrl, '_blank', 'noopener,noreferrer')
    
    // 清除选择状态
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
        
        // 获取选中文本的位置
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
    
    // 点击其他地方时清除选择（但不包括浮动按钮）
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // 如果点击的是浮动按钮或其子元素，不清除选择
      if (target.closest('[data-ask-advisor-button]')) {
        return
      }
      
      // 如果点击的是内容区域，不清除选择
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
  }, [material])

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

  if (error || !material) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-destructive">{error || '资料不存在'}</p>
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
            <span className="text-foreground">详情</span>
          </div>

          {/* Title */}
          {!isEditing ? (
            <h1 className="text-3xl font-bold mb-2">{material.title}</h1>
          ) : (
            <div className="mb-4">
              <Input
                type="text"
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="text-3xl font-bold border-2"
                placeholder="输入标题"
                disabled={saving}
              />
            </div>
          )}
          
          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium">类型：</span>
              <span>{material.type}</span>
            </div>
            {material.source && (
              <div className="flex items-center gap-2">
                <span className="font-medium">来源：</span>
                <span>
                  {material.source === 'ai_generated' ? 'AI 生成' : 
                   material.source === 'user_created' ? '用户创建' : 
                   material.source === 'system' ? '系统生成' : material.source}
                </span>
              </div>
            )}
          </div>
          
          <div className="mt-2 text-xs text-muted-foreground">
            创建时间：{new Date(material.createdAt).toLocaleString('zh-CN')}
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
                img({ node, src, alt, ...props }: any) {
                  // 从 imageMap 中获取实际的图片数据
                  const actualSrc = imageMap[src] || src
                  
                  console.log('[Material] Rendering img:', { 
                    placeholder: src,
                    hasMapping: !!imageMap[src],
                    actualSrcLength: actualSrc?.length || 0,
                    alt
                  })
                  
                  if (!actualSrc || actualSrc === '') {
                    console.warn('[Material] Skipping img with empty src, alt:', alt)
                    return null
                  }
                  
                  // 使用 span 而不是 div，避免在 p 标签内嵌套 div 的问题
                  return (
                    <span className="block my-4">
                      <span className="block rounded-lg overflow-hidden border border-border bg-muted/30">
                        <span className="relative group block">
                          <img
                            src={actualSrc}
                            alt={alt || '图片'}
                            className="w-full h-auto cursor-pointer transition-transform hover:scale-[1.02]"
                            onClick={() => setPreviewImage(actualSrc)}
                            loading="lazy"
                            {...props}
                          />
                          <button
                            onClick={() => setPreviewImage(actualSrc)}
                            className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="查看大图"
                          >
                            <ZoomIn className="h-4 w-4" />
                          </button>
                        </span>
                        {alt && (
                          <span className="block px-4 py-2 text-xs text-muted-foreground text-center bg-muted/50">
                            {alt}
                          </span>
                        )}
                      </span>
                    </span>
                  )
                },
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  const codeString = String(children).replace(/\n$/, '')
                  const language = match ? match[1] : ''
                  
                  if (!inline && language) {
                    // 生成唯一的代码块 ID
                    const codeId = `${language}_${codeString.substring(0, 50)}`
                    const isCollapsed = collapsedCodeBlocks[codeId] || false
                    
                    // 代码块
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
                    // 行内代码
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
                {material.contentMarkdown}
              </ReactMarkdown>
            </div>
          ) : (
            <MarkdownEditor
              value={editData.contentMarkdown}
              onChange={(value) => setEditData({ ...editData, contentMarkdown: value })}
              onImagesChange={setImageMap}
              initialImages={imageMap}
              disabled={saving}
              minHeight="500px"
            />
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
                  console.log('[Material] Button mousedown')
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('[Material] Button clicked, calling handleAskAdvisor')
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
      
      {/* 图片预览模态框 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={previewImage}
              alt="预览"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
