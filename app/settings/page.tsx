'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ConfigForm } from '@/components/settings/config-form'
import { EnvConfigForm } from '@/components/settings/env-config-form'
import { Home, Settings as SettingsIcon, Loader2, RefreshCw, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConfigDefinition } from '@/lib/config/config-service'
import type { EnvConfigDefinition } from '@/lib/config/env-service'

type ConfigData = {
  definitions: ConfigDefinition[]
  values: Record<string, any>
}

type EnvConfigData = {
  definitions: EnvConfigDefinition[]
  values: Record<string, string>
  actualValues: Record<string, string>
}

const mainCategories = ['app', 'env'] as const
type MainCategory = typeof mainCategories[number]

const mainCategoryLabels: Record<MainCategory, string> = {
  app: '应用配置',
  env: '环境变量',
}

const appCategoryLabels = {
  cleanup: '清理设置',
  notification: '通知设置',
  ai: 'AI 设置',
  general: '通用设置',
}

const appCategoryDescriptions = {
  cleanup: '管理 session 文件清理策略',
  notification: '配置学习提醒和报告通知',
  ai: '调整 AI 模型和参数',
  general: '其他系统设置',
}

const envCategoryLabels = {
  database: '数据库',
  auth: '认证',
  ai: 'AI 服务',
  storage: '存储',
  general: '通用',
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [configData, setConfigData] = useState<ConfigData | null>(null)
  const [envConfigData, setEnvConfigData] = useState<EnvConfigData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mainCategory, setMainCategory] = useState<MainCategory>('app')
  const [activeAppCategory, setActiveAppCategory] = useState<string>('cleanup')
  const [activeEnvCategory, setActiveEnvCategory] = useState<string>('ai')
  const [modifiedConfigs, setModifiedConfigs] = useState<Set<string>>(new Set())
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    loadConfigs()
    loadEnvConfigs()
  }, [])

  const loadConfigs = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/config', {
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to load configs')
      }

      const data = await res.json()
      setConfigData(data)

      // 检查哪些配置被修改过
      const modified = new Set<string>()
      for (const def of data.definitions) {
        const key = `${def.category}.${def.key}`
        const currentValue = data.values[key]
        if (JSON.stringify(currentValue) !== JSON.stringify(def.defaultValue)) {
          modified.add(key)
        }
      }
      setModifiedConfigs(modified)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configs')
    } finally {
      setLoading(false)
    }
  }

  const loadEnvConfigs = async () => {
    try {
      const res = await fetch('/api/config/env', {
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to load env configs')
      }

      const data = await res.json()
      setEnvConfigData(data)
    } catch (err) {
      console.error('Failed to load env configs:', err)
    }
  }

  const handleSave = async (category: string, key: string, value: any) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ category, key, value }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to save config')
    }

    // 重新加载配置
    await loadConfigs()
  }

  const handleReset = async (category: string, key: string) => {
    const res = await fetch(`/api/config?category=${category}&key=${key}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!res.ok) {
      throw new Error('Failed to reset config')
    }

    // 重新加载配置
    await loadConfigs()
  }

  const handleEnvSave = async (key: string, value: string) => {
    const res = await fetch('/api/config/env', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key, value }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to save env config')
    }

    const result = await res.json()
    
    // 重新加载配置
    await loadEnvConfigs()
    
    return { requiresRestart: result.requiresRestart }
  }

  const handleReloadCron = async () => {
    setReloading(true)
    try {
      const res = await fetch('/api/config/reload-cron', {
        method: 'POST',
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to reload cron jobs')
      }

      alert('定时任务已重新加载')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reload')
    } finally {
      setReloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载配置中...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={loadConfigs}>重试</Button>
        </div>
      </div>
    )
  }

  // 渲染应用配置
  const renderAppConfigs = () => {
    const currentDefinitions = configData?.definitions.filter(
      (d) => d.category === activeAppCategory && d.isPublic
    ) || []

    return (
      <>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            {appCategoryLabels[activeAppCategory as keyof typeof appCategoryLabels]}
          </h2>
          <p className="text-sm text-muted-foreground">
            {appCategoryDescriptions[activeAppCategory as keyof typeof appCategoryDescriptions]}
          </p>
        </div>

        {currentDefinitions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            此分类暂无可配置项
          </div>
        ) : (
          <div className="space-y-6">
            {currentDefinitions.map((def) => {
              const key = `${def.category}.${def.key}`
              const currentValue = configData?.values[key]
              const isModified = modifiedConfigs.has(key)

              return (
                <div
                  key={key}
                  className={cn(
                    'rounded-lg border border-border bg-card p-4',
                    isModified && 'border-primary/50 bg-primary/5'
                  )}
                >
                  <ConfigForm
                    definition={def}
                    currentValue={currentValue}
                    onSave={(value) => handleSave(def.category, def.key, value)}
                    onReset={() => handleReset(def.category, def.key)}
                    isModified={isModified}
                  />
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

  // 渲染环境变量配置
  const renderEnvConfigs = () => {
    if (!envConfigData) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          加载环境变量配置中...
        </div>
      )
    }

    const currentDefinitions = envConfigData.definitions.filter(
      (d) => d.category === activeEnvCategory
    )

    return (
      <>
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {envCategoryLabels[activeEnvCategory as keyof typeof envCategoryLabels]}
              </h2>
              <p className="text-sm text-muted-foreground">
                环境变量配置
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
              <Check className="h-4 w-4" />
              <span>修改后立即生效，无需重启</span>
            </div>
          </div>
        </div>

        {currentDefinitions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            此分类暂无配置项
          </div>
        ) : (
          <div className="space-y-6">
            {currentDefinitions.map((def) => {
              const currentValue = envConfigData.values[def.key] || ''
              const actualValue = envConfigData.actualValues[def.key] || ''

              return (
                <div
                  key={def.key}
                  className={cn(
                    'rounded-lg border border-border bg-card p-4',
                    def.required && !actualValue && 'border-destructive/50 bg-destructive/5'
                  )}
                >
                  <EnvConfigForm
                    definition={def}
                    currentValue={currentValue}
                    actualValue={actualValue}
                    onSave={(value) => handleEnvSave(def.key, value)}
                  />
                </div>
              )
            })}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 顶部栏 */}
      <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
        <SettingsIcon className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">系统设置</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReloadCron}
            disabled={reloading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", reloading && "animate-spin")} />
            重新加载定时任务
          </Button>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <Home className="h-4 w-4" />
              返回首页
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 主分类切换 */}
        <aside className="w-64 border-r border-border bg-muted/30">
          <div className="p-4 border-b border-border">
            <div className="space-y-1">
              {mainCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setMainCategory(cat)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-left transition-all',
                    mainCategory === cat
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  )}
                >
                  <div className="font-semibold text-sm">
                    {mainCategoryLabels[cat]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 子分类导航 */}
          <nav className="p-4">
            {mainCategory === 'app' ? (
              <div className="space-y-1">
                {Object.keys(appCategoryLabels).map((category) => {
                  const isActive = category === activeAppCategory
                  const configCount = configData?.definitions.filter(
                    (d) => d.category === category && d.isPublic
                  ).length || 0

                  return (
                    <button
                      key={category}
                      onClick={() => setActiveAppCategory(category)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2.5 text-left transition-all',
                        isActive
                          ? 'bg-primary/10 text-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      )}
                    >
                      <div className="font-medium text-sm">
                        {appCategoryLabels[category as keyof typeof appCategoryLabels]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {appCategoryDescriptions[category as keyof typeof appCategoryDescriptions]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {configCount} 项配置
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {Object.keys(envCategoryLabels).map((category) => {
                  const isActive = category === activeEnvCategory
                  const configCount = envConfigData?.definitions.filter(
                    (d) => d.category === category
                  ).length || 0

                  return (
                    <button
                      key={category}
                      onClick={() => setActiveEnvCategory(category)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2.5 text-left transition-all',
                        isActive
                          ? 'bg-primary/10 text-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                      )}
                    >
                      <div className="font-medium text-sm">
                        {envCategoryLabels[category as keyof typeof envCategoryLabels]}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {configCount} 项配置
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </nav>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl">
            {mainCategory === 'app' ? renderAppConfigs() : renderEnvConfigs()}
          </div>
        </main>
      </div>
    </div>
  )
}
