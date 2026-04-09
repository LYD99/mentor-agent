import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

// 获取加密密钥，如果未设置则抛出错误
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set. Please add it to your .env file.')
  }
  
  if (key.length !== 64) {
    throw new Error(`ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${key.length} characters`)
  }
  
  return key
}

export class EncryptionService {
  /**
   * 加密文本
   */
  static encrypt(text: string): string {
    const encryptionKey = getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(encryptionKey, 'hex'),
      iv
    )

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // 格式: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }

  /**
   * 解密文本
   */
  static decrypt(encryptedText: string): string {
    const encryptionKey = getEncryptionKey()
    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format')
    }

    const [ivHex, authTagHex, encrypted] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(encryptionKey, 'hex'),
      iv
    )
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }
}
