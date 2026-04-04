'use client'

import { useState, useEffect } from 'react'
import {
  Folder,
  FolderPlus,
  Edit2,
  Trash2,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  FileText,
  FileCode,
  FileImage,
  FileJson,
  FileSpreadsheet,
  File,
} from 'lucide-react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface FolderNode {
  id: string
  name: string
  description?: string | null
  parentId?: string | null
  materialCount: number
  children: FolderNode[]
}

interface Material {
  id: string
  title: string
  folderId?: string | null
  category: string
  createdAt: string
}

interface FolderManagerProps {
  folders: FolderNode[]
  materials: Material[]
  selectedFolderId?: string | null
  onSelectFolder: (folderId: string | null) => void
  onRefresh: () => void
  onMaterialClick: (materialId: string) => void
  onDeleteMaterial: (materialId: string) => void
}

export function FolderManager({
  folders,
  materials,
  selectedFolderId,
  onSelectFolder,
  onRefresh,
  onMaterialClick,
  onDeleteMaterial,
}: FolderManagerProps) {
  // 默认展开所有文件夹
  const getAllFolderIds = (folders: FolderNode[]): string[] => {
    const ids: string[] = []
    const traverse = (nodes: FolderNode[]) => {
      nodes.forEach((node) => {
        ids.push(node.id)
        if (node.children.length > 0) {
          traverse(node.children)
        }
      })
    }
    traverse(folders)
    return ids
  }

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    return new Set(getAllFolderIds(folders))
  })
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [currentFolder, setCurrentFolder] = useState<FolderNode | null>(null)
  const [folderForm, setFolderForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)

  // 当文件夹列表变化时，更新展开状态（保持所有文件夹展开）
  useEffect(() => {
    setExpandedFolders(new Set(getAllFolderIds(folders)))
  }, [folders])

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const handleCreateFolder = async () => {
    if (!folderForm.name.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/materials/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: folderForm.name,
          description: folderForm.description || null,
          parentId: currentFolder?.id || null,
        }),
      })

      if (response.ok) {
        setCreateDialogOpen(false)
        setFolderForm({ name: '', description: '' })
        setCurrentFolder(null)
        onRefresh()
      } else {
        const error = await response.json()
        alert(error.error || '创建失败')
      }
    } catch (error) {
      console.error('Create folder error:', error)
      alert('创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleEditFolder = async () => {
    if (!currentFolder || !folderForm.name.trim()) return

    setLoading(true)
    try {
      const response = await fetch(`/api/materials/folders/${currentFolder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: folderForm.name,
          description: folderForm.description || null,
        }),
      })

      if (response.ok) {
        setEditDialogOpen(false)
        setFolderForm({ name: '', description: '' })
        setCurrentFolder(null)
        onRefresh()
      } else {
        const error = await response.json()
        alert(error.error || '更新失败')
      }
    } catch (error) {
      console.error('Edit folder error:', error)
      alert('更新失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFolder = async () => {
    if (!currentFolder) return

    setLoading(true)
    try {
      const deleteContents = confirm(
        `确定要删除文件夹「${currentFolder.name}」吗？\n\n点击"确定"将删除文件夹及其所有内容（${currentFolder.materialCount} 份资料）\n点击"取消"将只删除文件夹，资料将移至上级目录`
      )

      const response = await fetch(
        `/api/materials/folders/${currentFolder.id}?deleteContents=${deleteContents}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      if (response.ok) {
        setDeleteDialogOpen(false)
        setCurrentFolder(null)
        if (selectedFolderId === currentFolder.id) {
          onSelectFolder(null)
        }
        onRefresh()
      } else {
        const error = await response.json()
        alert(error.error || '删除失败')
      }
    } catch (error) {
      console.error('Delete folder error:', error)
      alert('删除失败')
    } finally {
      setLoading(false)
    }
  }

  const openCreateDialog = (parentFolder?: FolderNode) => {
    setCurrentFolder(parentFolder || null)
    setFolderForm({ name: '', description: '' })
    setCreateDialogOpen(true)
  }

  const openEditDialog = (folder: FolderNode) => {
    setCurrentFolder(folder)
    setFolderForm({
      name: folder.name,
      description: folder.description || '',
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (folder: FolderNode) => {
    setCurrentFolder(folder)
    setDeleteDialogOpen(true)
  }

  // 根据文件扩展名获取对应的图标和颜色
  const getFileIconAndColor = (extension: string): { icon: any; color: string } => {
    const ext = extension.toLowerCase()
    
    // 代码文件 - 蓝色
    const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'vue', 'svelte']
    if (codeExts.includes(ext)) {
      return { icon: FileCode, color: 'text-blue-500' }
    }
    
    // 图片文件 - 紫色
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']
    if (imageExts.includes(ext)) {
      return { icon: FileImage, color: 'text-purple-500' }
    }
    
    // JSON/配置文件 - 黄色
    const jsonExts = ['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'conf', 'env']
    if (jsonExts.includes(ext)) {
      return { icon: FileJson, color: 'text-yellow-600' }
    }
    
    // 表格文件 - 绿色
    const spreadsheetExts = ['csv', 'xlsx', 'xls', 'tsv']
    if (spreadsheetExts.includes(ext)) {
      return { icon: FileSpreadsheet, color: 'text-green-600' }
    }
    
    // 文本/文档文件 - 灰色
    const textExts = ['md', 'txt', 'pdf', 'doc', 'docx']
    if (textExts.includes(ext)) {
      return { icon: FileText, color: 'text-gray-500' }
    }
    
    // 默认文件图标 - 灰色
    return { icon: File, color: 'text-gray-400' }
  }

  const renderFolder = (folder: FolderNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = selectedFolderId === folder.id
    const hasChildren = folder.children.length > 0
    const folderMaterials = materials.filter((m) => m.folderId === folder.id)
    const hasContent = hasChildren || folderMaterials.length > 0

    return (
      <div key={folder.id}>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group',
            isSelected && 'bg-primary/10 hover:bg-primary/15',
            level > 0 && 'ml-6'
          )}
        >
          {hasContent ? (
            <button
              onClick={() => toggleFolder(folder.id)}
              className="p-0.5 hover:bg-muted rounded flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}

          <button
            onClick={() => onSelectFolder(folder.id)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <Folder className="h-4 w-4 flex-shrink-0 text-rose-600" />
            <span className="text-sm font-medium truncate">{folder.name}</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openCreateDialog(folder)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                新建子文件夹
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEditDialog(folder)}>
                <Edit2 className="h-4 w-4 mr-2" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openDeleteDialog(folder)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isExpanded && hasContent && (
          <div className={cn('space-y-1', level > 0 && 'ml-6')}>
            {/* Render materials in this folder */}
            {folderMaterials.map((material) => {
              // 从标题中提取文件扩展名（如果有）
              const lastDotIndex = material.title.lastIndexOf('.')
              const hasExtension = lastDotIndex > 0 && lastDotIndex < material.title.length - 1
              const fileName = hasExtension ? material.title.substring(0, lastDotIndex) : material.title
              const fileExt = hasExtension ? material.title.substring(lastDotIndex + 1).toLowerCase() : ''
              
              // 获取对应的文件图标和颜色
              const { icon: FileIcon, color: iconColor } = getFileIconAndColor(fileExt)
              
              return (
                <div
                  key={material.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/30 transition-colors group/material ml-5"
                >
                  <FileIcon className={cn("h-3.5 w-3.5 flex-shrink-0", iconColor)} />
                  <button
                    onClick={() => onMaterialClick(material.id)}
                    className="flex-1 text-left min-w-0 flex items-center gap-1.5"
                  >
                    {fileExt && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                        {fileExt}
                      </span>
                    )}
                    <span className="text-xs text-foreground truncate">
                      {fileName}
                    </span>
                  </button>
                  <button
                    onClick={() => onDeleteMaterial(material.id)}
                    className="opacity-0 group-hover/material:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              )
            })}
            
            {/* Render child folders */}
            {folder.children.map((child) => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm font-semibold text-muted-foreground">文件夹</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openCreateDialog()}
          className="h-7 w-7 p-0"
        >
          <FolderPlus className="h-4 w-4" />
        </Button>
      </div>

      {/* All Materials */}
      <button
        onClick={() => onSelectFolder(null)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left',
          selectedFolderId === null && 'bg-primary/10 hover:bg-primary/15'
        )}
      >
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">全部资料</span>
      </button>

      {/* Folder Tree */}
      <div className="space-y-1">
        {folders.map((folder) => renderFolder(folder))}
      </div>

      {folders.length === 0 && (
        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
          <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>暂无文件夹</p>
          <Button
            variant="link"
            size="sm"
            onClick={() => openCreateDialog()}
            className="mt-2"
          >
            创建第一个文件夹
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentFolder ? `在「${currentFolder.name}」下创建子文件夹` : '创建文件夹'}
            </DialogTitle>
            <DialogDescription>
              为你的学习资料创建一个新的分类文件夹
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">文件夹名称 *</Label>
              <Input
                id="name"
                placeholder="例如：前端开发、算法学习"
                value={folderForm.name}
                onChange={(e) =>
                  setFolderForm({ ...folderForm, name: e.target.value })
                }
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述（可选）</Label>
              <Textarea
                id="description"
                placeholder="添加文件夹描述..."
                value={folderForm.description}
                onChange={(e) =>
                  setFolderForm({ ...folderForm, description: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button onClick={handleCreateFolder} disabled={loading || !folderForm.name.trim()}>
              {loading ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑文件夹</DialogTitle>
            <DialogDescription>修改文件夹的名称和描述</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">文件夹名称 *</Label>
              <Input
                id="edit-name"
                value={folderForm.name}
                onChange={(e) =>
                  setFolderForm({ ...folderForm, name: e.target.value })
                }
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">描述（可选）</Label>
              <Textarea
                id="edit-description"
                value={folderForm.description}
                onChange={(e) =>
                  setFolderForm({ ...folderForm, description: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button onClick={handleEditFolder} disabled={loading || !folderForm.name.trim()}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除文件夹</DialogTitle>
            <DialogDescription>
              确定要删除文件夹「{currentFolder?.name}」吗？
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-2">
              该文件夹包含 {currentFolder?.materialCount} 份资料。
            </p>
            <p className="text-sm text-muted-foreground">
              删除后，资料将移至上级目录。如需同时删除资料，请在确认对话框中选择。
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFolder}
              disabled={loading}
            >
              {loading ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
