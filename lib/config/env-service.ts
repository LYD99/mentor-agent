import fs from 'fs'
import path from 'path'
import { clearEnvCache } from './env-runtime'

export type EnvConfigDefinition = {
  key: string
  label: string
  description?: string
  category: string
  required: boolean
  defaultValue?: string
  sensitive?: boolean
  valueType?: 'string' | 'number' | 'boolean' | 'secret' | 'select'
  validation?: {
    pattern?: string
    options?: string[] | Array<{ value: string; label: string; description?: string }>
  }
  hidden?: boolean // 不在 UI 显示，但保留功能
  dependsOn?: string // 级联依赖：只有当指定的配置项为 true 时才显示此配置
  dependsOnKey?: string // 级联依赖：实际依赖的配置项 key
  dependsOnValue?: string // 级联依赖：依赖的配置项需要等于此值才显示
  // 配置组：当这个配置项改变时，自动同步设置其他配置项
  syncWith?: Array<{
    key: string
    value: string | ((mainValue: string) => string)
  }>
}

// 环境变量定义
export const ENV_CONFIG_DEFINITIONS: EnvConfigDefinition[] = [
  // 数据库
  {
    key: 'DATABASE_URL',
    label: '数据库 URL',
    description: 'SQLite 数据库文件路径',
    category: 'database',
    required: true,
    defaultValue: 'file:./prisma/data/app.db',
    sensitive: false,
  },

  // 认证
  // AUTH_SECRET 由启动脚本自动生成，不在设置页面显示
  // {
  //   key: 'AUTH_SECRET',
  //   label: '认证密钥',
  //   description: 'NextAuth.js 使用的密钥（自动生成）',
  //   category: 'auth',
  //   required: true,
  //   sensitive: true,
  // },
  {
    key: 'AUTH_URL',
    label: '认证 URL',
    description: '应用的基础 URL',
    category: 'auth',
    required: false,
    defaultValue: 'http://localhost:3000',
    sensitive: false,
  },

  // AI 服务
  {
    key: 'AI_API_KEY',
    label: 'AI API Key',
    description: 'AI API 密钥',
    category: 'ai',
    required: true,
    sensitive: true,
  },
  {
    key: 'AI_BASE_URL',
    label: 'AI Base URL',
    description: 'AI API 基础 URL（可选，用于代理）',
    category: 'ai',
    required: false,
    sensitive: false,
  },
  {
    key: 'AI_MODEL',
    label: 'AI 模型',
    description: 'AI 模型名称（如 deepseek-chat, gpt-4o-mini 等）',
    category: 'ai',
    required: false,
    defaultValue: 'deepseek-chat',
    sensitive: false,
  },
  {
    key: 'TAVILY_API_KEY',
    label: 'Research API Key',
    description: 'Tavily API 密钥（用于网络研究功能）',
    category: 'ai',
    required: false,
    sensitive: true,
  },
  {
    key: 'LESSON_AGENT_MODEL',
    label: 'Lesson Agent 模型',
    description: '学习资料生成专用模型（推荐 gpt-4o）',
    category: 'ai',
    required: false,
    sensitive: false,
  },
  {
    key: 'ADVISOR_AGENT_MODEL',
    label: 'Advisor Agent 模型',
    description: '学习辅导专用模型（推荐 gpt-4o）',
    category: 'ai',
    required: false,
    sensitive: false,
  },
  {
    key: 'PLAN_AGENT_MODEL',
    label: 'Plan Agent 模型',
    description: '成长地图生成专用模型（推荐 gpt-4o）',
    category: 'ai',
    required: false,
    sensitive: false,
  },
  {
    key: 'SCHEDULE_AGENT_MODEL',
    label: 'Schedule Agent 模型',
    description: '学习计划生成专用模型（可用 gpt-4o-mini）',
    category: 'ai',
    required: false,
    sensitive: false,
  },
  {
    key: 'SCHEDULE_BATCH_CONCURRENCY',
    label: 'Schedule Agent 并发数',
    description: '学习计划批次生成并发限制（1-20，默认 5，DeepSeek 推荐 3-5）',
    category: 'ai',
    required: false,
    defaultValue: '5',
    sensitive: false,
    valueType: 'number',
  },
  // 质量验证配置
  {
    key: 'ENABLE_QUALITY_VALIDATION',
    label: '启用质量验证',
    description: '是否启用学习资料质量验证',
    category: 'ai',
    required: false,
    defaultValue: 'true',
    sensitive: false,
    valueType: 'boolean',
    validation: {
      options: ['true', 'false'],
    },
  },
  {
    key: 'QUALITY_VALIDATION_MODE',
    label: '验证模式',
    description: '选择质量验证策略',
    category: 'ai',
    required: false,
    defaultValue: 'rule-based&llm-based',
    sensitive: false,
    valueType: 'select',
    validation: {
      options: [
        { value: 'rule-based', label: '仅规则检查', description: '基于代码规则的质量检查' },
        { value: 'rule-based&llm-based', label: '规则检查 + LLM 评估', description: '双重验证，更全面（推荐）' },
      ],
    },
    syncWith: [
      { 
        key: 'ENABLE_LLM_QUALITY_ASSESSMENT', 
        value: (mode: string) => mode === 'rule-based&llm-based' ? 'true' : 'false'
      },
    ],
    dependsOn: 'ENABLE_QUALITY_VALIDATION',
  },
  {
    key: 'MIN_QUALITY_SCORE',
    label: '规则检查阈值',
    description: '代码规则检查的最低分数（0-100，默认 70）',
    category: 'ai',
    required: false,
    defaultValue: '70',
    sensitive: false,
    valueType: 'number',
    dependsOn: 'ENABLE_QUALITY_VALIDATION',
  },
  {
    key: 'ENABLE_LLM_QUALITY_ASSESSMENT',
    label: 'ENABLE_LLM_QUALITY_ASSESSMENT',
    description: '内部配置：是否启用 LLM 评估',
    category: 'ai',
    required: false,
    defaultValue: 'true',
    sensitive: false,
    valueType: 'boolean',
    validation: {
      options: ['true', 'false'],
    },
    hidden: true, // 隐藏，由验证模式自动控制
  },
  {
    key: 'LLM_QUALITY_MIN_SCORE',
    label: 'LLM 评估阈值',
    description: 'LLM 质量评估的最低分数（0-100，默认 75）',
    category: 'ai',
    required: false,
    defaultValue: '75',
    sensitive: false,
    valueType: 'number',
    dependsOn: 'ENABLE_QUALITY_VALIDATION',
    dependsOnValue: 'rule-based&llm-based', // 依赖 QUALITY_VALIDATION_MODE 的值
    dependsOnKey: 'QUALITY_VALIDATION_MODE', // 实际依赖的配置项
  },

  // 存储
  {
    key: 'STORAGE_PATH',
    label: '存储路径',
    description: 'Session 文件存储路径',
    category: 'storage',
    required: false,
    defaultValue: './data/local/sessions',
    sensitive: false,
  },

  // 通用
  {
    key: 'NODE_ENV',
    label: '运行环境',
    description: '应用运行环境',
    category: 'general',
    required: false,
    defaultValue: 'development',
    sensitive: false,
  },
  {
    key: 'PORT',
    label: '端口',
    description: '应用监听端口',
    category: 'general',
    required: false,
    defaultValue: '3000',
    sensitive: false,
  },
]

/**
 * 获取所有环境变量定义
 */
export function getEnvConfigDefinitions(): EnvConfigDefinition[] {
  return ENV_CONFIG_DEFINITIONS.filter((def) => !def.hidden)
}

/**
 * 获取指定分类的环境变量定义
 */
export function getEnvConfigDefinitionsByCategory(category: string): EnvConfigDefinition[] {
  return ENV_CONFIG_DEFINITIONS.filter((def) => def.category === category && !def.hidden)
}

/**
 * 获取单个环境变量定义
 */
export function getEnvConfigDefinition(key: string): EnvConfigDefinition | undefined {
  return ENV_CONFIG_DEFINITIONS.find((def) => def.key === key)
}

/**
 * 获取 .env 文件路径
 */
function getEnvPath(): string {
  return path.join(process.cwd(), '.env')
}

/**
 * 读取 .env 文件内容
 */
function readEnvFile(): Record<string, string> {
  const envPath = getEnvPath()
  const values: Record<string, string> = {}

  if (!fs.existsSync(envPath)) {
    return values
  }

  const content = fs.readFileSync(envPath, 'utf-8')
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) continue

    const key = trimmed.substring(0, equalIndex).trim()
    let value = trimmed.substring(equalIndex + 1).trim()

    // 移除引号
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1)
    }

    values[key] = value
  }

  return values
}

/**
 * 写入 .env 文件
 */
function writeEnvFile(values: Record<string, string>): void {
  const envPath = getEnvPath()
  const lines: string[] = []

  // 添加注释
  lines.push('# Environment Variables')
  lines.push('# Generated by Mentor Agent Settings')
  lines.push('')

  // 按分类组织
  const categories = new Set(ENV_CONFIG_DEFINITIONS.map(def => def.category))
  
  for (const category of categories) {
    const defs = ENV_CONFIG_DEFINITIONS.filter(def => def.category === category && !def.hidden)
    if (defs.length === 0) continue

    lines.push(`# ${category.toUpperCase()}`)
    
    for (const def of defs) {
      if (def.description) {
        lines.push(`# ${def.description}`)
      }
      
      const value = values[def.key]
      if (value !== undefined) {
        // 如果值包含空格或特殊字符，用引号包裹
        const needsQuotes = value.includes(' ') || value.includes('#')
        lines.push(`${def.key}=${needsQuotes ? `"${value}"` : value}`)
      } else if (def.defaultValue) {
        lines.push(`# ${def.key}=${def.defaultValue}`)
      } else {
        lines.push(`# ${def.key}=`)
      }
    }
    
    lines.push('')
  }

  fs.writeFileSync(envPath, lines.join('\n'), 'utf-8')
}

/**
 * 获取所有环境变量值
 */
export function getAllEnvValues(): {
  values: Record<string, string>
  actualValues: Record<string, string>
} {
  const fileValues = readEnvFile()
  const actualValues: Record<string, string> = {}

  // 获取实际运行时的值
  for (const def of ENV_CONFIG_DEFINITIONS) {
    const value = process.env[def.key]
    if (value) {
      actualValues[def.key] = value
    }
  }

  return {
    values: fileValues,
    actualValues,
  }
}

/**
 * 设置环境变量值
 */
export function setEnvValue(key: string, value: string): void {
  const definition = getEnvConfigDefinition(key)
  if (!definition) {
    throw new Error(`Environment variable not found: ${key}`)
  }

  const currentValues = readEnvFile()
  currentValues[key] = value
  
  // 如果有 syncWith 配置，自动同步设置其他配置项
  if (definition.syncWith) {
    for (const sync of definition.syncWith) {
      const syncValue = typeof sync.value === 'function' ? sync.value(value) : sync.value
      currentValues[sync.key] = syncValue
      console.log(`[Env Service] Auto-sync ${sync.key} = ${syncValue} (from ${key})`)
    }
  }
  
  writeEnvFile(currentValues)
  
  // 清除缓存，确保下次读取时获取最新值
  clearEnvCache()
}

/**
 * 删除环境变量值
 */
export function deleteEnvValue(key: string): void {
  const currentValues = readEnvFile()
  delete currentValues[key]
  writeEnvFile(currentValues)
  
  // 清除缓存，确保下次读取时获取最新值
  clearEnvCache()
}

/**
 * 检查是否需要重启应用
 */
export function requiresRestart(key: string): boolean {
  // 使用运行时读取，不需要重启
  return false
}
