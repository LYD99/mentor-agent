'use client'

import { useEffect, useState } from 'react'
import { ModuleShell } from '@/components/layout/module-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Edit, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type ExternalBot = {
  id: string
  name: string
  platform: string
  description?: string
  webhookUrl?: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

type BotFormData = {
  name: string
  platform: string
  description: string
  webhookUrl: string
  appId: string
  appSecret: string
  token: string
  aesKey: string
  enabled: boolean
}

const PLATFORM_OPTIONS = [
  { value: 'wecom', label: '企业微信' },
  { value: 'dingtalk', label: '钉钉' },
  { value: 'feishu', label: '飞书' },
  { value: 'slack', label: 'Slack' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'custom', label: '自定义' },
]

export default function BotConfigPage() {
  const [bots, setBots] = useState<ExternalBot[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<BotFormData>({
    name: '',
    platform: 'wecom',
    description: '',
    webhookUrl: '',
    appId: '',
    appSecret: '',
    token: '',
    aesKey: '',
    enabled: true,
  })
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadBots()
  }, [])

  const loadBots = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bot', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load bots')
      const data = await res.json()
      setBots(data.bots || [])
    } catch (error) {
      console.error('Failed to load bots:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingId(null)
    setFormData({
      name: '',
      platform: 'wecom',
      description: '',
      webhookUrl: '',
      appId: '',
      appSecret: '',
      token: '',
      aesKey: '',
      enabled: true,
    })
    setShowForm(true)
  }

  const handleEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/bot/${id}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load bot')
      const data = await res.json()
      const bot = data.bot
      setEditingId(id)
      setFormData({
        name: bot.name || '',
        platform: bot.platform || 'wecom',
        description: bot.description || '',
        webhookUrl: bot.webhookUrl || '',
        appId: bot.appId || '',
        appSecret: bot.appSecret || '',
        token: bot.token || '',
        aesKey: bot.aesKey || '',
        enabled: bot.enabled ?? true,
      })
      setShowForm(true)
    } catch (error) {
      console.error('Failed to load bot:', error)
      alert('加载 Bot 配置失败')
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.platform.trim()) {
      alert('请填写 Bot 名称和平台')
      return
    }

    setSaving(true)
    try {
      const url = editingId ? `/api/bot/${editingId}` : '/api/bot'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error('Failed to save bot')

      await loadBots()
      setShowForm(false)
    } catch (error) {
      console.error('Failed to save bot:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除 Bot "${name}" 吗？`)) return

    try {
      const res = await fetch(`/api/bot/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to delete bot')
      await loadBots()
    } catch (error) {
      console.error('Failed to delete bot:', error)
      alert('删除失败')
    }
  }

  const toggleSecret = (field: string) => {
    setShowSecrets((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  if (loading) {
    return (
      <ModuleShell title="Bot 配置">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </ModuleShell>
    )
  }

  return (
    <ModuleShell title="Bot 配置">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">外部 Bot 接入</h2>
            <p className="text-sm text-muted-foreground mt-1">
              配置企业微信、钉钉等外部通讯平台的 Bot 接入
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            新建 Bot
          </Button>
        </div>

        {showForm && (
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {editingId ? '编辑 Bot' : '新建 Bot'}
            </h3>

            <div className="grid gap-4">
              <div>
                <Label htmlFor="name">Bot 名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：企业微信助手"
                />
              </div>

              <div>
                <Label htmlFor="platform">平台类型 *</Label>
                <select
                  id="platform"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="description">描述</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Bot 用途说明"
                />
              </div>

              <div>
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  value={formData.webhookUrl}
                  onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="appId">App ID</Label>
                  <Input
                    id="appId"
                    value={formData.appId}
                    onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="appSecret">App Secret</Label>
                  <div className="relative">
                    <Input
                      id="appSecret"
                      type={showSecrets.appSecret ? 'text' : 'password'}
                      value={formData.appSecret}
                      onChange={(e) => setFormData({ ...formData, appSecret: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret('appSecret')}
                      className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets.appSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="token">Token</Label>
                  <div className="relative">
                    <Input
                      id="token"
                      type={showSecrets.token ? 'text' : 'password'}
                      value={formData.token}
                      onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret('token')}
                      className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets.token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="aesKey">AES Key</Label>
                  <div className="relative">
                    <Input
                      id="aesKey"
                      type={showSecrets.aesKey ? 'text' : 'password'}
                      value={formData.aesKey}
                      onChange={(e) => setFormData({ ...formData, aesKey: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret('aesKey')}
                      className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets.aesKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled" className="cursor-pointer">
                  启用此 Bot
                </Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                取消
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {bots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>还没有配置任何 Bot</p>
              <p className="text-sm mt-2">点击上方"新建 Bot"按钮开始配置</p>
            </div>
          ) : (
            bots.map((bot) => (
              <div
                key={bot.id}
                className={cn(
                  'rounded-lg border border-border bg-card p-4',
                  !bot.enabled && 'opacity-60'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{bot.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {PLATFORM_OPTIONS.find((p) => p.value === bot.platform)?.label || bot.platform}
                      </span>
                      {bot.enabled ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                          已启用
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          已禁用
                        </span>
                      )}
                    </div>
                    {bot.description && (
                      <p className="text-sm text-muted-foreground mt-1">{bot.description}</p>
                    )}
                    {bot.webhookUrl && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {bot.webhookUrl}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(bot.id)}
                      className="gap-1"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(bot.id, bot.name)}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium mb-2">提示</p>
          <ul className="list-disc list-inside space-y-1">
            <li>配置完成后，需要在对应平台设置回调 URL 指向本应用</li>
            <li>敏感信息（Secret、Token 等）会加密存储，请妥善保管</li>
            <li>目前仅支持配置管理，实际消息处理功能需要额外开发</li>
          </ul>
        </div>
      </div>
    </ModuleShell>
  )
}
