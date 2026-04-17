import crypto from 'crypto'
import { ensureEnvSecret } from '../config/env-runtime'

const ALGORITHM = 'aes-256-gcm'
const EXPECTED_KEY_LENGTH = 64 // 32 字节 hex 编码

/**
 * 获取加密密钥：自愈式 —— 缺失或格式不合法（不是 64 位 hex）都会自动重新
 * 生成并持久化到 .env.local。
 *
 * ⚠️ 注意：ENCRYPTION_KEY 换掉后，旧密文（比如之前加密的 RAG API Key）
 *    将无法解密。本函数只在 key 完全缺失/格式不合法时才重新生成，不会
 *    因为「觉得不够安全」而轻易重置。
 */
function getEncryptionKey(): string {
  return ensureEnvSecret('ENCRYPTION_KEY', {
    generator: () => crypto.randomBytes(32).toString('hex'),
    placeholders: ['your-64-char-hex-key-here', ''],
    logPrefix: '[encryption]',
    validate: (v) => v.length === EXPECTED_KEY_LENGTH && /^[0-9a-fA-F]+$/.test(v),
  })
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
