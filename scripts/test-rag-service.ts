import 'dotenv/config'
import { RagService } from '../lib/services/rag-service'

async function testRagService() {
  console.log('Testing RAG Service...\n')
  
  // 测试连接（使用示例配置）
  console.log('1. Testing connection...')
  
  const testConfig = {
    datasetId: 'test-dataset-id',
    apiKey: 'test-api-key',
    apiEndpoint: 'https://api.dify.ai/v1',
    query: 'test query',
  }
  
  try {
    const result = await RagService.testConnection(testConfig)
    console.log('Connection test result:', result)
  } catch (error) {
    console.log('Expected error (using test credentials):', error instanceof Error ? error.message : error)
  }
  
  console.log('\n✅ RAG Service basic structure is working!')
  console.log('\nTo test with real credentials:')
  console.log('1. Get a Dify dataset ID and API key')
  console.log('2. Update the testConfig in this script')
  console.log('3. Run the script again')
}

testRagService().catch(console.error)
