'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Check, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import type { EnvConfigDefinition } from '@/lib/config/env-service'

type EnvConfigFormProps = {
  definition: EnvConfigDefinition
  currentValue: string
  actualValue: string
  onSave: (value: string) => Promise<{ requiresRestart: boolean }>
  onValueChange?: (value: string) => void
}

export function EnvConfigForm({
  definition,
  currentValue,
  actualValue,
  onSave,
  onValueChange,
}: EnvConfigFormProps) {
  const [value, setValue] = useState(currentValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [requiresRestart, setRequiresRestart] = useState(false)

  const handleValueChange = (newValue: string) => {
    setValue(newValue)
    // 立即通知父组件值已改变（用于实时显示/隐藏）
    if (onValueChange) {
      onValueChange(newValue)
    }
  }

  const handleSave = async () => {
    setError(null)
    setSuccess(false)
    setRequiresRestart(false)
    setSaving(true)

    try {
      const result = await onSave(value)
      setSuccess(true)
      if (result.requiresRestart) {
        setRequiresRestart(true)
      }
      setTimeout(() => {
        setSuccess(false)
        setRequiresRestart(false)
      }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const renderInput = () => {
    const isSensitive = definition.sensitive || definition.valueType === 'secret'
    const inputType = isSensitive && !showSecret ? 'password' : 'text'

    if (definition.validation?.options) {
      return (
        <select
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          disabled={saving}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">请选择...</option>
          {definition.validation.options.map((option: string | { value: string; label: string; description?: string }) => {
            // 支持两种格式：字符串数组 或 对象数组
            if (typeof option === 'string') {
              return (
                <option key={option} value={option}>
                  {option}
                </option>
              )
            } else {
              return (
                <option key={option.value} value={option.value} title={option.description}>
                  {option.label}
                </option>
              )
            }
          })}
        </select>
      )
    }

    return (
      <div className="relative">
        <Input
          type={inputType}
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          disabled={saving}
          placeholder={definition.defaultValue || `输入 ${definition.label}`}
        />
        {isSensitive && (
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    )
  }

  const hasChanged = value !== currentValue
  const isEmpty = !actualValue || actualValue.trim() === ''
  const isRequired = definition.required

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`env-${definition.key}`} className="text-sm font-medium">
            {definition.label}
          </Label>
          {isRequired && (
            <span className="text-xs text-destructive">*必填</span>
          )}
        </div>
        {definition.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {definition.description}
          </p>
        )}
      </div>

      {renderInput()}

      {isRequired && isEmpty && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          此配置项为必填项，请设置有效值
        </div>
      )}

      {definition.validation && (
        <div className="text-xs text-muted-foreground">
          {definition.validation.pattern && (
            <span>格式要求: {definition.validation.pattern}</span>
          )}
          {definition.validation.options && (
            <span>可选值: {definition.validation.options.join(', ')}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !hasChanged}
        >
          {saving ? '保存中...' : '保存'}
        </Button>

        {success && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3.5 w-3.5" />
            已保存
          </span>
        )}

        {requiresRestart && (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            需要重启应用
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {definition.defaultValue && (
        <div className="text-xs text-muted-foreground">
          默认值: {definition.sensitive ? '********' : definition.defaultValue}
        </div>
      )}
    </div>
  )
}
