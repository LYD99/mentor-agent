import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getEnv, clearEnvCache, hasEnv } from '@/lib/config/env-runtime'
import { setEnvValue, deleteEnvValue } from '@/lib/config/env-service'
import fs from 'fs'
import path from 'path'

describe('Environment Runtime', () => {
  const testEnvPath = path.join(process.cwd(), '.env.local')
  let originalContent: string | null = null

  beforeEach(() => {
    // 备份原始文件
    if (fs.existsSync(testEnvPath)) {
      originalContent = fs.readFileSync(testEnvPath, 'utf-8')
    }
  })

  afterEach(() => {
    // 恢复原始文件
    if (originalContent !== null) {
      fs.writeFileSync(testEnvPath, originalContent, 'utf-8')
    }
    clearEnvCache()
  })

  it('should read env value from .env.local file', () => {
    setEnvValue('AI_API_KEY', 'test-api-key-123')
    
    const value = getEnv('AI_API_KEY')
    expect(value).toBe('test-api-key-123')
  })

  it('should update env value immediately after modification', () => {
    // 第一次设置
    setEnvValue('AI_API_KEY', 'first-value')
    expect(getEnv('AI_API_KEY')).toBe('first-value')
    
    // 修改值
    setEnvValue('AI_API_KEY', 'second-value')
    
    // 立即读取，应该得到新值
    const newValue = getEnv('AI_API_KEY')
    expect(newValue).toBe('second-value')
  })

  it('should handle missing env variable', () => {
    const value = getEnv('NON_EXISTENT_KEY')
    expect(value).toBeUndefined()
  })

  it('should use default value when env not set', () => {
    const value = getEnv('NON_EXISTENT_KEY', 'default-value')
    expect(value).toBe('default-value')
  })

  it('should check if env exists', () => {
    setEnvValue('TEST_KEY', 'test-value')
    
    expect(hasEnv('TEST_KEY')).toBe(true)
    expect(hasEnv('NON_EXISTENT_KEY')).toBe(false)
  })

  it('should delete env value and reflect immediately', () => {
    setEnvValue('TEST_KEY', 'test-value')
    expect(hasEnv('TEST_KEY')).toBe(true)
    
    deleteEnvValue('TEST_KEY')
    
    // 立即检查，应该已经删除
    expect(hasEnv('TEST_KEY')).toBe(false)
  })

  it('should cache values for performance', async () => {
    setEnvValue('TEST_KEY', 'cached-value')
    
    // 第一次读取
    const value1 = getEnv('TEST_KEY')
    
    // 直接修改文件（绕过 setEnvValue）
    const content = fs.readFileSync(testEnvPath, 'utf-8')
    const newContent = content.replace('cached-value', 'modified-directly')
    fs.writeFileSync(testEnvPath, newContent, 'utf-8')
    
    // 由于缓存，应该还是旧值
    const value2 = getEnv('TEST_KEY')
    expect(value2).toBe('cached-value')
    
    // 等待缓存过期（1秒）
    await new Promise(resolve => setTimeout(resolve, 1100))
    
    // 现在应该读取到新值
    const value3 = getEnv('TEST_KEY')
    expect(value3).toBe('modified-directly')
  })

  it('should clear cache on setEnvValue', () => {
    setEnvValue('TEST_KEY', 'first')
    expect(getEnv('TEST_KEY')).toBe('first')
    
    // setEnvValue 会清除缓存
    setEnvValue('TEST_KEY', 'second')
    
    // 立即读取应该得到新值（不受缓存影响）
    expect(getEnv('TEST_KEY')).toBe('second')
  })
})
