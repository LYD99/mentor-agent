import { prisma } from '@/lib/db'

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json' | 'text'

export type ConfigValidation = {
  min?: number
  max?: number
  pattern?: string
  maxLength?: number
  options?: string[]
}

export type ConfigDefinition = {
  category: string
  key: string
  label: string
  description?: string
  valueType: ConfigValueType
  defaultValue: any
  validation?: ConfigValidation
  isPublic: boolean
}

// 配置定义
export const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  // 清理设置
  {
    category: 'cleanup',
    key: 'sessionRetentionDays',
    label: 'Session 保留天数',
    description: '超过此天数的 session 文件将被清理',
    valueType: 'number',
    defaultValue: 30,
    validation: { min: 1, max: 365 },
    isPublic: true,
  },
  {
    category: 'cleanup',
    key: 'autoCleanup',
    label: '自动清理',
    description: '是否启用自动清理过期的 session 文件',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true,
  },
  {
    category: 'cleanup',
    key: 'cleanupSchedule',
    label: '清理计划',
    description: 'Cron 表达式，定义清理任务的执行时间',
    valueType: 'string',
    defaultValue: '0 2 * * *',
    validation: { pattern: 'cron' },
    isPublic: true,
  },

  // 通知设置
  {
    category: 'notification',
    key: 'enableLearningReminders',
    label: '启用学习提醒',
    description: '是否发送学习任务提醒',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true,
  },
  {
    category: 'notification',
    key: 'reminderSchedule',
    label: '提醒计划',
    description: 'Cron 表达式，定义提醒任务的执行时间',
    valueType: 'string',
    defaultValue: '0 9 * * *',
    validation: { pattern: 'cron' },
    isPublic: true,
  },
  {
    category: 'notification',
    key: 'enableWeeklyReport',
    label: '启用周报',
    description: '是否发送每周学习报告',
    valueType: 'boolean',
    defaultValue: true,
    isPublic: true,
  },
  {
    category: 'notification',
    key: 'weeklyReportSchedule',
    label: '周报计划',
    description: 'Cron 表达式，定义周报发送时间',
    valueType: 'string',
    defaultValue: '0 10 * * 1',
    validation: { pattern: 'cron' },
    isPublic: true,
  },

  // AI 设置
  {
    category: 'ai',
    key: 'defaultModel',
    label: '默认模型',
    description: 'AI 对话使用的默认模型',
    valueType: 'string',
    defaultValue: 'gpt-4o',
    isPublic: true,
  },
  {
    category: 'ai',
    key: 'temperature',
    label: '温度参数',
    description: '控制 AI 回复的随机性 (0-2)',
    valueType: 'number',
    defaultValue: 0.7,
    validation: { min: 0, max: 2 },
    isPublic: true,
  },
  {
    category: 'ai',
    key: 'maxTokens',
    label: '最大 Token 数',
    description: 'AI 回复的最大长度',
    valueType: 'number',
    defaultValue: 4000,
    validation: { min: 100, max: 16000 },
    isPublic: true,
  },

  // 通用设置
  {
    category: 'general',
    key: 'appName',
    label: '应用名称',
    description: '显示在页面标题的应用名称',
    valueType: 'string',
    defaultValue: 'Mentor Agent',
    isPublic: true,
  },
  {
    category: 'general',
    key: 'enableDebugMode',
    label: '调试模式',
    description: '启用后会输出更多日志信息',
    valueType: 'boolean',
    defaultValue: false,
    isPublic: true,
  },
]

/**
 * 获取所有配置定义
 */
export function getConfigDefinitions(): ConfigDefinition[] {
  return CONFIG_DEFINITIONS
}

/**
 * 获取指定分类的配置定义
 */
export function getConfigDefinitionsByCategory(category: string): ConfigDefinition[] {
  return CONFIG_DEFINITIONS.filter((def) => def.category === category)
}

/**
 * 获取单个配置定义
 */
export function getConfigDefinition(category: string, key: string): ConfigDefinition | undefined {
  return CONFIG_DEFINITIONS.find((def) => def.category === category && def.key === key)
}

/**
 * 获取配置值（从数据库或默认值）
 */
export async function getConfigValue(category: string, key: string): Promise<any> {
  const definition = getConfigDefinition(category, key)
  if (!definition) {
    throw new Error(`Config not found: ${category}.${key}`)
  }

  const config = await prisma.systemConfig.findUnique({
    where: {
      category_key: {
        category,
        key,
      },
    },
  })

  if (!config) {
    return definition.defaultValue
  }

  // 根据类型解析值
  return parseConfigValue(config.value, definition.valueType)
}

/**
 * 获取所有配置值
 */
export async function getAllConfigValues(): Promise<Record<string, any>> {
  const configs = await prisma.systemConfig.findMany()
  const values: Record<string, any> = {}

  // 先填充默认值
  for (const def of CONFIG_DEFINITIONS) {
    const key = `${def.category}.${def.key}`
    values[key] = def.defaultValue
  }

  // 覆盖数据库中的值
  for (const config of configs) {
    const key = `${config.category}.${config.key}`
    const definition = getConfigDefinition(config.category, config.key)
    if (definition) {
      values[key] = parseConfigValue(config.value, definition.valueType)
    }
  }

  return values
}

/**
 * 设置配置值
 */
export async function setConfigValue(category: string, key: string, value: any): Promise<void> {
  const definition = getConfigDefinition(category, key)
  if (!definition) {
    throw new Error(`Config not found: ${category}.${key}`)
  }

  // 验证值
  validateConfigValue(value, definition)

  // 序列化值
  const serializedValue = serializeConfigValue(value, definition.valueType)

  await prisma.systemConfig.upsert({
    where: {
      category_key: {
        category,
        key,
      },
    },
    create: {
      category,
      key,
      value: serializedValue,
      valueType: definition.valueType,
      label: definition.label,
      description: definition.description,
      defaultValue: serializeConfigValue(definition.defaultValue, definition.valueType),
      validation: definition.validation ? JSON.stringify(definition.validation) : null,
      isPublic: definition.isPublic,
    },
    update: {
      value: serializedValue,
    },
  })
}

/**
 * 删除配置值（恢复为默认值）
 */
export async function deleteConfigValue(category: string, key: string): Promise<void> {
  await prisma.systemConfig.delete({
    where: {
      category_key: {
        category,
        key,
      },
    },
  })
}

/**
 * 解析配置值
 */
function parseConfigValue(value: string, valueType: ConfigValueType): any {
  switch (valueType) {
    case 'string':
      return value
    case 'number':
      return Number(value)
    case 'boolean':
      return value === 'true'
    case 'json':
      return JSON.parse(value)
    default:
      return value
  }
}

/**
 * 序列化配置值
 */
function serializeConfigValue(value: any, valueType: ConfigValueType): string {
  switch (valueType) {
    case 'string':
      return String(value)
    case 'number':
      return String(value)
    case 'boolean':
      return String(value)
    case 'json':
      return JSON.stringify(value)
    default:
      return String(value)
  }
}

/**
 * 验证配置值
 */
function validateConfigValue(value: any, definition: ConfigDefinition): void {
  if (!definition.validation) return

  const rules = definition.validation

  if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
    throw new Error(`Value must be at least ${rules.min}`)
  }

  if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
    throw new Error(`Value must be at most ${rules.max}`)
  }

  if (rules.pattern === 'cron' && typeof value === 'string') {
    const cronParts = value.split(' ')
    if (cronParts.length !== 5) {
      throw new Error('Invalid cron expression')
    }
  }

  if (rules.maxLength !== undefined && typeof value === 'string' && value.length > rules.maxLength) {
    throw new Error(`Value must be at most ${rules.maxLength} characters`)
  }

  if (rules.options && Array.isArray(rules.options) && !rules.options.includes(value)) {
    throw new Error(`Value must be one of: ${rules.options.join(', ')}`)
  }
}
