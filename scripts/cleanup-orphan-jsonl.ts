/**
 * 清理孤儿 JSONL 文件
 * 删除没有对应数据库记录的会话文件
 */

import { prisma } from '../lib/db'
import fs from 'fs/promises'
import path from 'path'
import { getEnv } from '../lib/config/env-runtime'

const getLocalDataDir = () => getEnv('LOCAL_DATA_DIR') || './data/local'

async function cleanupOrphanJsonl() {
  console.log('🔍 开始扫描孤儿 JSONL 文件...\n')
  
  try {
    // 1. 获取数据库中所有有效的会话 ID
    const sessions = await prisma.chatSession.findMany({
      select: { id: true, jsonlPath: true }
    })
    
    const validSessionIds = new Set(sessions.map(s => s.id))
    console.log(`✅ 数据库中有 ${validSessionIds.size} 个有效会话\n`)
    
    // 2. 扫描 JSONL 文件目录
    const sessionsDir = path.join(process.cwd(), getLocalDataDir(), 'sessions')
    
    let files: string[] = []
    try {
      files = await fs.readdir(sessionsDir)
    } catch (error) {
      console.log('⚠️  sessions 目录不存在或无法访问')
      return
    }
    
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'))
    console.log(`📁 找到 ${jsonlFiles.length} 个 JSONL 文件\n`)
    
    // 3. 识别孤儿文件
    const orphanFiles: string[] = []
    for (const file of jsonlFiles) {
      const sessionId = file.replace('.jsonl', '')
      if (!validSessionIds.has(sessionId)) {
        orphanFiles.push(file)
      }
    }
    
    if (orphanFiles.length === 0) {
      console.log('✨ 没有发现孤儿文件，一切正常！')
      return
    }
    
    console.log(`🗑️  发现 ${orphanFiles.length} 个孤儿文件：\n`)
    
    // 4. 显示文件信息
    let totalSize = 0
    for (const file of orphanFiles) {
      const filePath = path.join(sessionsDir, file)
      const stats = await fs.stat(filePath)
      const sizeKB = (stats.size / 1024).toFixed(2)
      totalSize += stats.size
      console.log(`   - ${file} (${sizeKB} KB)`)
    }
    
    console.log(`\n📊 总计: ${(totalSize / 1024).toFixed(2)} KB\n`)
    
    // 5. 删除孤儿文件
    console.log('🧹 开始清理...\n')
    
    let deletedCount = 0
    let failedCount = 0
    
    for (const file of orphanFiles) {
      const filePath = path.join(sessionsDir, file)
      try {
        await fs.unlink(filePath)
        deletedCount++
        console.log(`   ✅ 已删除: ${file}`)
      } catch (error) {
        failedCount++
        console.error(`   ❌ 删除失败: ${file}`, error)
      }
    }
    
    console.log(`\n✨ 清理完成！`)
    console.log(`   - 成功删除: ${deletedCount} 个文件`)
    if (failedCount > 0) {
      console.log(`   - 删除失败: ${failedCount} 个文件`)
    }
    console.log(`   - 释放空间: ${(totalSize / 1024).toFixed(2)} KB\n`)
    
  } catch (error) {
    console.error('❌ 清理过程出错:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 运行清理
cleanupOrphanJsonl()
  .then(() => {
    console.log('👋 清理任务结束')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 清理任务失败:', error)
    process.exit(1)
  })
