import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appendJsonLine, readJsonLines, getLineCount } from '@/lib/storage/jsonl-append'
import fs from 'fs/promises'
import path from 'path'

describe('JSONL Append', () => {
  const testDir = path.join(process.cwd(), 'data/test-sessions')
  const testFile = path.join(testDir, 'test-session.jsonl')

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should append a JSON line to file', async () => {
    const data = { id: 'msg_1', role: 'user', text: 'Hello' }
    const lineNum = await appendJsonLine(testFile, data)
    
    expect(lineNum).toBe(1)
    
    const content = await fs.readFile(testFile, 'utf-8')
    expect(content).toBe(JSON.stringify(data) + '\n')
  })

  it('should handle concurrent appends to same file', async () => {
    const promises = Array.from({ length: 10 }, (_, i) => 
      appendJsonLine(testFile, { id: `msg_${i}`, seq: i })
    )
    
    const lineNums = await Promise.all(promises)
    
    // 所有行号应该在 1-10 范围内且唯一
    expect(lineNums.length).toBe(10)
    expect(new Set(lineNums).size).toBe(10) // 所有行号唯一
    expect(Math.min(...lineNums)).toBe(1)
    expect(Math.max(...lineNums)).toBe(10)
    
    // 最重要：文件中应该有完整的 10 条消息
    const lines = await readJsonLines(testFile)
    expect(lines).toHaveLength(10)
    
    // 验证所有消息都被写入
    const seqs = lines.map(l => l.seq).sort((a, b) => a - b)
    expect(seqs).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('should read specific line range', async () => {
    // 写入 5 条
    for (let i = 0; i < 5; i++) {
      await appendJsonLine(testFile, { seq: i })
    }
    
    const lines = await readJsonLines(testFile, { start: 2, end: 4 })
    expect(lines).toHaveLength(3) // 行 2, 3, 4
    expect(lines[0].seq).toBe(1) // 行 2 的内容（seq 从 0 开始）
  })

  it('should return empty array for non-existent file', async () => {
    const lines = await readJsonLines('/nonexistent/file.jsonl')
    expect(lines).toEqual([])
  })

  it('should get line count', async () => {
    for (let i = 0; i < 3; i++) {
      await appendJsonLine(testFile, { seq: i })
    }
    
    const count = await getLineCount(testFile)
    expect(count).toBe(3)
  })
})
