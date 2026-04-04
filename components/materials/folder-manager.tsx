'use client'

import { useState } from 'react'
import {
  Folder,
  FolderPlus,
  Edit2,
  Trash2,
  MoreVertical,
  ChevronRight,
  ChevronDown,
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

interface FolderManagerProps {
  folders: FolderNode[]
  selectedFolderId?: string | null
  onSelectFolder: (folderId: string | null) => void
  onRefresh: () => void
}

export function FolderManager({
  folders,
  selectedFolderId,
  onSelectFolder,
  onRefresh,
}: FolderManagerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [currentFolder, setCurrentFolder] = useState<FolderNode | null>(null)
  const [folderForm, setFolderForm] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(false)

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

  const renderFolder = (folder: FolderNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = selectedFolderId === folder.id
    const hasChildren = folder.children.length > 0

    return (
      <div key={folder.id}>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group',
            isSelected && 'bg-primary/10 hover:bg-primary/15',
            level > 0 && 'ml-6'
          )}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleFolder(folder.id)}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <button
            onClick={() => onSelectFolder(folder.id)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <Folder className="h-4 w-4 flex-shrink-0 text-rose-600" />
            <span className="text-sm font-medium truncate">{folder.name}</span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              ({folder.materialCount})
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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

        {isExpanded && hasChildren && (
          <div>
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
