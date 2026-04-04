'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, FileText, Loader2, CheckCircle2, XCircle, Folder, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface BatchUploadDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  folders?: Array<{ id: string; name: string }>
  defaultFolderId?: string
}

interface FileWithStatus {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  materialId?: string
}

export function BatchUploadDialog({
  open,
  onClose,
  onSuccess,
  folders = [],
  defaultFolderId,
}: BatchUploadDialogProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([])
  const [folderId, setFolderId] = useState<string>(defaultFolderId || 'none')
  const [tags, setTags] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }, [])

  const addFiles = (newFiles: File[]) => {
    const filesWithStatus: FileWithStatus[] = newFiles.map((file) => ({
      file,
      status: 'pending' as const,
    }))
    setFiles((prev) => [...prev, ...filesWithStatus])
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)

    try {
      const formData = new FormData()
      files.forEach((f) => {
        formData.append('files', f.file)
      })

      if (folderId && folderId !== 'none') {
        formData.append('folderId', folderId)
      }

      if (tags.trim()) {
        const tagArray = tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t)
        formData.append('tags', JSON.stringify(tagArray))
      }

      // 更新所有文件状态为 uploading
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: 'uploading' as const }))
      )

      const response = await fetch('/api/materials/batch-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()

      // 更新文件状态
      setFiles((prev) =>
        prev.map((f) => {
          const successItem = result.success.find(
            (s: any) => s.filename === f.file.name
          )
          const failedItem = result.failed.find(
            (s: any) => s.filename === f.file.name
          )

          if (successItem) {
            return {
              ...f,
              status: 'success' as const,
              materialId: successItem.id,
            }
          } else if (failedItem) {
            return {
              ...f,
              status: 'error' as const,
              error: failedItem.error,
            }
          }
          return f
        })
      )

      // 如果全部成功，延迟关闭对话框
      if (result.failed.length === 0) {
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 1500)
      }
    } catch (error) {
      console.error('Upload error:', error)
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: 'error' as const,
          error: '上传失败，请重试',
        }))
      )
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setFiles([])
    setFolderId(defaultFolderId || 'none')
    setTags('')
    setUploading(false)
    onClose()
  }

  const getStatusIcon = (status: FileWithStatus['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>批量导入学习资料</DialogTitle>
          <DialogDescription>
            支持 Markdown (.md)、纯文本 (.txt) 和 PDF (.pdf) 格式，单个文件最大 10MB
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* 文件夹选择 */}
          <div className="space-y-2">
            <Label>目标文件夹</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="选择文件夹" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未分类</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      {folder.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 标签 */}
          <div className="space-y-2">
            <Label>标签（可选）</Label>
            <Input
              placeholder="输入标签，用逗号分隔"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              disabled={uploading}
            />
          </div>

          {/* 拖拽上传区域 */}
          <div
            className={cn(
              'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50',
              uploading && 'opacity-50 pointer-events-none'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,.markdown,.txt,.pdf"
              onChange={handleFileInput}
              className="hidden"
              disabled={uploading}
            />

            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-2">
              拖拽文件到这里，或
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline ml-1"
                disabled={uploading}
              >
                点击选择文件
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              支持 .md, .txt, .pdf 格式
            </p>
          </div>

          {/* 文件列表 */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label>已选择文件 ({files.length})</Label>
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {files.map((fileWithStatus, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                  >
                    {getStatusIcon(fileWithStatus.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {fileWithStatus.file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(fileWithStatus.file.size)}
                        {fileWithStatus.error && (
                          <span className="text-red-600 ml-2">
                            - {fileWithStatus.error}
                          </span>
                        )}
                      </p>
                    </div>
                    {!uploading && fileWithStatus.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            取消
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                上传 {files.length} 个文件
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
