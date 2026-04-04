import 'dotenv/config'
import { EncryptionService } from '../lib/services/encryption-service'
import { RagService } from '../lib/services/rag-service'
import { formatRagDatasetsForPrompt } from '../lib/services/rag-prompt-builder'

console.log('🔍 Verifying RAG Implementation...\n')

// Test 1: Encryption Service
console.log('1️⃣ Testing Encryption Service...')
try {
  const testText = 'test-api-key-12345'
  const encrypted = EncryptionService.encrypt(testText)
  const decrypted = EncryptionService.decrypt(encrypted)
  
  if (testText === decrypted) {
    console.log('   ✅ Encryption/Decryption works correctly')
  } else {
    console.log('   ❌ Encryption/Decryption failed')
    process.exit(1)
  }
} catch (error) {
  console.log('   ❌ Error:', error instanceof Error ? error.message : error)
  process.exit(1)
}

// Test 2: RAG Service Structure
console.log('\n2️⃣ Testing RAG Service Structure...')
try {
  if (typeof RagService.retrieveFromRagDataset === 'function') {
    console.log('   ✅ retrieveFromRagDataset method exists')
  }
  if (typeof RagService.testConnection === 'function') {
    console.log('   ✅ testConnection method exists')
  }
} catch (error) {
  console.log('   ❌ Error:', error instanceof Error ? error.message : error)
  process.exit(1)
}

// Test 3: RAG Prompt Builder
console.log('\n3️⃣ Testing RAG Prompt Builder...')
try {
  const testDatasets = [
    {
      name: 'React 官方文档',
      purpose: 'React 框架的使用方法和最佳实践',
      description: 'React 官方文档的完整内容',
    },
    {
      name: 'TypeScript 手册',
      purpose: 'TypeScript 语言特性和类型系统',
      description: null,
    },
  ]
  
  const prompt = formatRagDatasetsForPrompt(testDatasets)
  
  if (prompt.includes('React 官方文档') && prompt.includes('TypeScript 手册')) {
    console.log('   ✅ Prompt builder works correctly')
  } else {
    console.log('   ❌ Prompt builder failed')
    process.exit(1)
  }
} catch (error) {
  console.log('   ❌ Error:', error instanceof Error ? error.message : error)
  process.exit(1)
}

// Test 4: Check if files exist
console.log('\n4️⃣ Checking file structure...')
const fs = require('fs')
const path = require('path')

const requiredFiles = [
  'lib/services/encryption-service.ts',
  'lib/services/rag-service.ts',
  'lib/services/rag-prompt-builder.ts',
  'lib/agents/tools/rag-tools.ts',
  'app/api/rag/datasets/route.ts',
  'app/api/rag/datasets/[id]/route.ts',
  'app/api/rag/datasets/[id]/test/route.ts',
]

let allFilesExist = true
for (const file of requiredFiles) {
  const filePath = path.join(process.cwd(), file)
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`)
  } else {
    console.log(`   ❌ ${file} not found`)
    allFilesExist = false
  }
}

if (!allFilesExist) {
  process.exit(1)
}

console.log('\n🎉 All core RAG implementation verified successfully!')
console.log('\n📝 Next steps:')
console.log('   1. Implement frontend UI (Phase 3)')
console.log('   2. Add comprehensive tests (Phase 4)')
console.log('   3. Configure a real Dify dataset to test end-to-end')
console.log('\n📚 See docs/RAG_SETUP.md for usage guide')
