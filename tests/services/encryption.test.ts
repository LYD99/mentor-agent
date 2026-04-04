import { describe, it, expect, beforeAll } from 'vitest'
import { EncryptionService } from '@/lib/services/encryption-service'

describe('EncryptionService', () => {
  beforeAll(() => {
    // 确保环境变量已设置
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY must be set for tests')
    }
  })

  it('should encrypt and decrypt text correctly', () => {
    const originalText = 'test-api-key-123'
    
    const encrypted = EncryptionService.encrypt(originalText)
    const decrypted = EncryptionService.decrypt(encrypted)
    
    expect(decrypted).toBe(originalText)
  })

  it('should produce different encrypted outputs for same input', () => {
    const text = 'same-text'
    
    const encrypted1 = EncryptionService.encrypt(text)
    const encrypted2 = EncryptionService.encrypt(text)
    
    // 由于使用随机 IV，每次加密结果应该不同
    expect(encrypted1).not.toBe(encrypted2)
    
    // 但解密后应该相同
    expect(EncryptionService.decrypt(encrypted1)).toBe(text)
    expect(EncryptionService.decrypt(encrypted2)).toBe(text)
  })

  it('should handle empty string', () => {
    const encrypted = EncryptionService.encrypt('')
    const decrypted = EncryptionService.decrypt(encrypted)
    
    expect(decrypted).toBe('')
  })

  it('should handle special characters', () => {
    const specialText = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`'
    
    const encrypted = EncryptionService.encrypt(specialText)
    const decrypted = EncryptionService.decrypt(encrypted)
    
    expect(decrypted).toBe(specialText)
  })

  it('should handle unicode characters', () => {
    const unicodeText = '你好世界 🌍 こんにちは'
    
    const encrypted = EncryptionService.encrypt(unicodeText)
    const decrypted = EncryptionService.decrypt(encrypted)
    
    expect(decrypted).toBe(unicodeText)
  })

  it('should handle long text', () => {
    const longText = 'a'.repeat(10000)
    
    const encrypted = EncryptionService.encrypt(longText)
    const decrypted = EncryptionService.decrypt(encrypted)
    
    expect(decrypted).toBe(longText)
  })

  it('should throw error on invalid encrypted text', () => {
    expect(() => {
      EncryptionService.decrypt('invalid-encrypted-text')
    }).toThrow()
  })

  it('should throw error on tampered encrypted text', () => {
    const encrypted = EncryptionService.encrypt('original-text')
    
    // 篡改加密文本
    const tampered = encrypted.slice(0, -5) + 'xxxxx'
    
    expect(() => {
      EncryptionService.decrypt(tampered)
    }).toThrow()
  })

  it('should produce encrypted text in correct format', () => {
    const encrypted = EncryptionService.encrypt('test')
    
    // 格式: iv:authTag:encryptedData (都是 hex 编码)
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(3)
    
    // IV 应该是 32 个字符（16 字节的 hex）
    expect(parts[0]).toHaveLength(32)
    
    // Auth tag 应该是 32 个字符（16 字节的 hex）
    expect(parts[1]).toHaveLength(32)
    
    // 所有部分都应该是有效的 hex 字符串
    parts.forEach(part => {
      expect(/^[0-9a-f]+$/i.test(part)).toBe(true)
    })
  })
})
