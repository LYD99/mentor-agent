'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AlertCircle, Check, RotateCcw } from 'lucide-react'
import type { ConfigDefinition } from '@/lib/config/config-service'

type ConfigFormProps = {
  definition: ConfigDefinition
  currentValue: any
  onSave: (value: any) => Promise<void>
  onReset: () => Promise<void>
  isModified: boolean
}

export function ConfigForm({
  definition,
  currentValue,
  onSave,
  onReset,
  isModified,
}: ConfigFormProps) {
  const [value, setValue] = useState(currentValue)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const validationRules = definition.validation || {}

  const handleSave = async () => {
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      await onSave(value)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      await onReset()
      setValue(definition.defaultValue)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setSaving(false)
    }
  }

  const renderInput = () => {
    switch (definition.valueType) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={`config-${definition.key}`}
              checked={value}
              onCheckedChange={setValue}
              disabled={saving}
            />
            <Label
              htmlFor={`config-${definition.key}`}
              className="text-sm font-normal cursor-pointer"
            >
              {value ? '启用' : '禁用'}
            </Label>
          </div>
        )

      case 'number':
        const minVal = validationRules['min']
        const maxVal = validationRules['max']
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value))}
            disabled={saving}
            min={minVal ? Number(minVal) : undefined}
            max={maxVal ? Number(maxVal) : undefined}
            className="max-w-xs"
          />
        )

      case 'string':
        if (validationRules.options) {
          return (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={saving}
              className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {validationRules.options.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )
        }
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            className="max-w-xs"
          />
        )

      case 'text':
        return (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
            rows={6}
            placeholder="补充系统指令（可选）"
          />
        )

      case 'json':
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                setValue(JSON.parse(e.target.value))
              } catch {
                setValue(e.target.value)
              }
            }}
            disabled={saving}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            rows={4}
          />
        )

      default:
        return null
    }
  }

  const hasChanged = JSON.stringify(value) !== JSON.stringify(currentValue)

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`config-${definition.key}`} className="text-sm font-medium">
          {definition.label}
        </Label>
        {definition.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {definition.description}
          </p>
        )}
      </div>

      {renderInput()}

      {definition.validation && (
        <div className="text-xs text-muted-foreground">
          {validationRules['min'] !== undefined && validationRules['max'] !== undefined && (
            <span>范围: {validationRules['min']} - {validationRules['max']}</span>
          )}
          {validationRules['pattern'] && (
            <span>格式: Cron 表达式</span>
          )}
          {validationRules['maxLength'] && (
            <span>最大长度: {validationRules['maxLength']} 字符</span>
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

        {isModified && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            恢复默认
          </Button>
        )}

        {success && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3.5 w-3.5" />
            已保存
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        默认值: {JSON.stringify(definition.defaultValue)}
      </div>
    </div>
  )
}
