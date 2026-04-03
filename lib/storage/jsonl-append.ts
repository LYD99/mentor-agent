import fs from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'

// 每个文件一个锁（Promise 链）
const fileLocks = new Map<string, Promise<void>>()

export async function appendJsonLine(
  filePath: string,
  data: any
): Promise<number> {
  // 确保目录存在
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  
  // 获取当前锁
  const currentLock = fileLocks.get(filePath) || Promise.resolve()
  
  let result: number
  
  // 创建新锁：等待当前锁完成后执行写入
  const newLock = currentLock.then(async () => {
    const line = JSON.stringify(data) + '\n'
    await fs.appendFile(filePath, line, 'utf-8')
    
    // 返回行号（当前文件总行数）
    const content = await fs.readFile(filePath, 'utf-8')
    result = content.split('\n').filter(l => l.trim()).length
  })
  
  // 更新锁（无论成功失败都继续链）
  fileLocks.set(filePath, newLock.catch(() => {}))
  
  // 等待写入完成并返回结果
  await newLock
  return result!
}

export async function readJsonLines(
  filePath: string,
  options?: { start?: number; end?: number }
): Promise<any[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    
    const start = options?.start || 1
    const end = options?.end || lines.length
    
    return lines
      .slice(start - 1, end)
      .map(line => JSON.parse(line))
  } catch (error: any) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

export async function getLineCount(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return content.split('\n').filter(l => l.trim()).length
  } catch (error: any) {
    if (error.code === 'ENOENT') return 0
    throw error
  }
}

export function hashLine(data: any): string {
  return createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
}
