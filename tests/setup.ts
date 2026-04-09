import '@testing-library/jest-dom'
import { beforeAll, afterAll, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// Load environment variables for tests
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  })
}

// Setup test environment
beforeAll(() => {
  // Global test setup
})

afterEach(() => {
  // Cleanup after each test
})

afterAll(() => {
  // Global test teardown
})
