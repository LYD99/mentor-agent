import 'dotenv/config'
import { EncryptionService } from '../lib/services/encryption-service'

// 测试加密和解密
const testText = 'test-api-key-12345'

console.log('Original text:', testText)

const encrypted = EncryptionService.encrypt(testText)
console.log('Encrypted:', encrypted)

const decrypted = EncryptionService.decrypt(encrypted)
console.log('Decrypted:', decrypted)

if (testText === decrypted) {
  console.log('✅ Encryption/Decryption works correctly!')
} else {
  console.log('❌ Encryption/Decryption failed!')
  process.exit(1)
}
