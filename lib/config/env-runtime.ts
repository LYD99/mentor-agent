import fs from 'fs'
import path from 'path'

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
