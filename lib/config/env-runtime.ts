import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * 运行时环境变量管理
 * 直接从 .env.local 文件读取，确保配置修改立即生效
 */

let cachedEnvValues: Record<string, string> | null = null
let lastReadTime = 0
const CACHE_TTL = 1000 // 缓存 1 秒，避免频繁读文件

/**
 * 获取 .env 文件路径
 * 优先使用 .env.local，如果不存在则使用 .env
 */
function getEnvLocalPath(): string {
  const envLocal = path.join(process.cwd(), '.env.local')
  const envFile = path.join(process.cwd(), '.env')
  
  if (fs.existsSync(envLocal)) {
    return envLocal
  }
  
  return envFile
}

/**
 * 从 .env.local 文件读取所有环境变量
 */
function readEnvLocalFile(): Record<string, string> {
  const envPath = getEnvLocalPath()
  const values: Record<string, string> = {}

  if (!fs.existsSync(envPath)) {
    return values
  }

  try {
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
  } catch (error) {
    console.error('Failed to read .env.local:', error)
  }

  return values
}

/**
 * 获取所有环境变量（带缓存）
 */
function getAllEnvValues(): Record<string, string> {
  const now = Date.now()
  
  // 如果缓存有效，直接返回
  if (cachedEnvValues && (now - lastReadTime) < CACHE_TTL) {
    return cachedEnvValues
  }

  // 读取文件并更新缓存
  cachedEnvValues = readEnvLocalFile()
  lastReadTime = now

  return cachedEnvValues
}

/**
 * 清除缓存，强制下次读取时重新加载文件
 */
export function clearEnvCache(): void {
  cachedEnvValues = null
  lastReadTime = 0
}

/**
 * 获取单个环境变量值
 * 优先从 .env.local 读取，如果没有则从 process.env 读取
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  const envValues = getAllEnvValues()
  return envValues[key] ?? process.env[key] ?? defaultValue
}

/**
 * 获取必需的环境变量，如果不存在则抛出错误
 */
export function getRequiredEnv(key: string): string {
  const value = getEnv(key)
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`)
  }
  return value
}

/**
 * 批量获取环境变量
 */
export function getEnvs(keys: string[]): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  for (const key of keys) {
    result[key] = getEnv(key)
  }
  return result
}

/**
 * 检查环境变量是否存在
 */
export function hasEnv(key: string): boolean {
  return getEnv(key) !== undefined
}

/**
 * 将 key=value 写入目标 env 文件（不存在则追加、存在则替换）
 * 写入成功后会清掉 env 缓存。失败时抛错。
 */
function persistEnvToFile(key: string, value: string): string {
  const envLocalPath = path.join(process.cwd(), '.env.local')
  const envPath = path.join(process.cwd(), '.env')
  const target = fs.existsSync(envLocalPath) ? envLocalPath : envPath

  let content = ''
  if (fs.existsSync(target)) {
    content = fs.readFileSync(target, 'utf-8')
  }

  const lineRegex = new RegExp(`^${key}=.*$`, 'm')
  if (lineRegex.test(content)) {
    content = content.replace(lineRegex, `${key}=${value}`)
  } else {
    const sep = content === '' || content.endsWith('\n') ? '' : '\n'
    content += `${sep}${key}=${value}\n`
  }

  fs.writeFileSync(target, content, 'utf-8')
  clearEnvCache()
  return target
}

export interface EnsureSecretOptions {
  /** 生成新 secret 的函数，默认 32 字节 base64 */
  generator?: () => string
  /** 用于判断「占位符」的值，匹配到也视为未配置 */
  placeholders?: string[]
  /** 日志前缀，如 "[auth]" */
  logPrefix?: string
  /** 校验现有值是否合法（返回 false 则视为无效，重新生成） */
  validate?: (value: string) => boolean
}

/**
 * 确保某个 env secret 一定存在：
 * 1. 优先读 .env / .env.local / process.env（并经过 validate）
 * 2. 若仍缺失/无效，自动生成
 * 3. 尽力写回 env 文件持久化；失败时仅注入 process.env
 *
 * 适用于 AUTH_SECRET、ENCRYPTION_KEY 这类「不应让应用启动失败」的基础
 * 设施 secret。注意：ENCRYPTION_KEY 若用于加密既有数据，一旦换掉旧值，
 * 老密文将无法解密 —— 所以这里优先保证「首次生成立刻持久化」。
 */
export function ensureEnvSecret(key: string, options: EnsureSecretOptions = {}): string {
  const {
    generator = () => crypto.randomBytes(32).toString('base64'),
    placeholders = [],
    logPrefix = '[env]',
    validate,
  } = options

  const existing = getEnv(key)
  const isPlaceholder = existing && placeholders.includes(existing)
  const isValid = existing && !isPlaceholder && (validate ? validate(existing) : true)

  if (isValid) return existing as string

  const generated = generator()
  process.env[key] = generated

  if (process.env.NEXT_RUNTIME !== 'edge') {
    try {
      const target = persistEnvToFile(key, generated)
      console.warn(
        `${logPrefix} ${key} ${existing ? '无效' : '缺失'}，已自动生成并写入 ${path.basename(target)}`
      )
    } catch (err) {
      console.warn(
        `${logPrefix} ${key} ${existing ? '无效' : '缺失'}，已生成临时值（文件写入失败，进程重启后会重新生成）：`,
        err instanceof Error ? err.message : err
      )
    }
  }

  return generated
}
