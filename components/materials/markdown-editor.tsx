'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, Image as ImageIcon, Eye, EyeOff, Loader2, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onImagesChange?: (images: Record<string, string>) => void
  initialImages?: Record<string, string>  // 初始图片映射
  placeholder?: string
  minHeight?: string
  disabled?: boolean
}

export function MarkdownEditor({
  value,
  onChange,
  onImagesChange,
  initialImages = {},
  placeholder = '支持 Markdown 格式...',
  minHeight = '400px',
  disabled = false,
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 存储图片数据（imageId -> URL）
  const [imageMap, setImageMap] = useState<Record<string, string>>(initialImages)
  
  // 代码块折叠状态
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState<Record<string, boolean>>({})
  
  // 代码复制状态
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // 当 initialImages 变化时，更新 imageMap
  useEffect(() => {
    if (initialImages && Object.keys(initialImages).length > 0) {
      setImageMap(initialImages)
    }
  }, [initialImages])

  // 当 imageMap 变化时，通知父组件
  useEffect(() => {
    if (onImagesChange) {
      onImagesChange(imageMap)
    }
  }, [imageMap, onImagesChange])

  /**
   * 将图片文件转换为 base64 data URL
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * 插入图片到 Markdown
   */
  const insertImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件')
        return
      }

      // 验证文件大小（10MB）
      if (file.size > 10 * 1024 * 1024) {
        alert('图片大小不能超过 10MB')
        return
      }

      setUploading(true)
      try {
        // 转换为 base64
        const dataUrl = await fileToBase64(file)
        
        // 生成唯一的图片 ID
        const imageId = `image_${Date.now()}_${Math.random().toString(36).substring(7)}`
        
        // 保存到 imageMap（占位符 -> base64 data URL 的映射）
        setImageMap((prev) => ({
          ...prev,
          [imageId]: dataUrl,
        }))

        // 生成 Markdown 图片语法（使用占位符 ID）
        const imageMarkdown = `![${file.name}](${imageId})`
        
        // 插入到光标位置
        const textarea = textareaRef.current
        if (textarea) {
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const newValue =
            value.substring(0, start) +
            imageMarkdown +
            value.substring(end)
          
          onChange(newValue)
          
          // 恢复光标位置
          setTimeout(() => {
            textarea.focus()
            const newPosition = start + imageMarkdown.length
            textarea.setSelectionRange(newPosition, newPosition)
          }, 0)
        } else {
          // 如果没有 textarea，追加到末尾
          onChange(value + '\n\n' + imageMarkdown + '\n')
        }
      } catch (error) {
        console.error('Failed to process image:', error)
        alert('图片处理失败，请重试')
      } finally {
        setUploading(false)
      }
    },
    [value, onChange]
  )

  /**
   * 处理文件选择
   */
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        Array.from(files).forEach((file) => insertImage(file))
      }
      // 清空 input，允许重复选择同一文件
      e.target.value = ''
    },
    [insertImage]
  )

  /**
   * 处理粘贴事件（支持粘贴图片）
   */
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await insertImage(file)
          }
        }
      }
    },
    [insertImage]
  )

  /**
   * 处理拖拽事件
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            await insertImage(file)
          }
        }
      }
    },
    [insertImage]
  )

  /**
   * 复制代码到剪贴板
   */
  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  /**
   * 渲染预览（将占位符 ID 替换为实际的 base64 数据）
   */
  const renderPreview = () => {
    return (
      <div className="prose prose-sm sm:prose-base max-w-none prose-headings:font-bold prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img({ node, src, alt, ...props }: any) {
              // 从 imageMap 中获取实际的 URL（src 是占位符 ID）
              const actualSrc = imageMap[src] || src
              
              if (!actualSrc || actualSrc === '') {
                return null
              }
              
              // 使用 span 而不是 div，避免在 p 标签内嵌套 div 的问题
              return (
                <span className="block my-4">
                  <span className="block rounded-lg overflow-hidden border border-border bg-muted/30">
                    <img
                      src={actualSrc}
                      alt={alt || '图片'}
                      className="w-full h-auto"
                      loading="lazy"
                      {...props}
                    />
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
          {value || '*暂无内容*'}
        </ReactMarkdown>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>内容 *</Label>
        <div className="flex items-center gap-2">
          {uploading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              上传中...
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            插入图片
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit" className="gap-2">
            <Upload className="h-4 w-4" />
            编辑
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" />
            预览
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-2">
          <div
            className={cn(
              'relative rounded-md border border-input bg-background transition-colors',
              isDragging && 'border-primary bg-primary/5',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <textarea
              ref={textareaRef}
              className="w-full rounded-md px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              style={{ minHeight }}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onPaste={handlePaste}
              disabled={disabled}
              required
            />
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-md pointer-events-none">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-primary mb-2" />
                  <p className="text-sm font-medium text-primary">
                    拖放图片到这里
                  </p>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            支持 Markdown 语法 | 支持粘贴图片（Ctrl+V）| 支持拖拽图片 | 单张图片最大 10MB
          </p>
        </TabsContent>

        <TabsContent value="preview" className="mt-2">
          <div
            className="rounded-md border border-input bg-background px-4 py-3 overflow-auto"
            style={{ minHeight }}
          >
            {renderPreview()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
