'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MarkdownEditor } from '@/components/materials/markdown-editor'

export default function NewMaterialPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: 'custom',
    title: '',
    contentMarkdown: '',
    tags: [] as string[],
  })
  const [imageMap, setImageMap] = useState<Record<string, string>>({})

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 提取 Markdown 中实际使用的图片 ID
      const usedImageIds = extractUsedImageIds(formData.contentMarkdown)
      
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
        createdAt: new Date().toISOString(),
      })

      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          contentJson,
        }),
      })

      if (res.ok) {
        const { material } = await res.json()
        router.push(`/materials/${material.id}`)
      } else {
        alert('创建失败，请重试')
      }
    } catch (err) {
      console.error('Failed to create material:', err)
      alert('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/materials">
            <Button variant="ghost" size="sm" className="mb-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              返回资料列表
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">新建学习资料</h1>
          <p className="mt-2 text-muted-foreground">
            创建一份新的学习笔记或资料
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-6">
            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">资料类型</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">自定义笔记</SelectItem>
                  <SelectItem value="daily_lesson">每日学习资料</SelectItem>
                  <SelectItem value="user_note">学习笔记</SelectItem>
                  <SelectItem value="ai_summary">AI 生成摘要</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">标题 *</Label>
              <Input
                id="title"
                type="text"
                placeholder="输入资料标题"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            {/* Content */}
            <MarkdownEditor
              value={formData.contentMarkdown}
              onChange={(value) =>
                setFormData({ ...formData, contentMarkdown: value })
              }
              onImagesChange={setImageMap}
              disabled={loading}
            />

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">标签（可选）</Label>
              <Input
                id="tags"
                type="text"
                placeholder="输入标签，用逗号分隔"
                onChange={(e) => {
                  const tags = e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t)
                  setFormData({ ...formData, tags })
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Link href="/materials">
              <Button type="button" variant="outline">
                取消
              </Button>
            </Link>
            <Button type="submit" disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
