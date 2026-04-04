import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始修复 LearningMaterial 的 status 字段...')
  
  // 查找所有 status 不是 'active' 或 'archived' 的记录
  const invalidRecords = await prisma.learningMaterial.findMany({
    where: {
      status: {
        notIn: ['active', 'archived']
      }
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    }
  })
  
  console.log(`找到 ${invalidRecords.length} 条需要修复的记录`)
  
  if (invalidRecords.length > 0) {
    console.log('\n需要修复的记录：')
    invalidRecords.forEach((record, index) => {
      console.log(`${index + 1}. ${record.title} (status: ${record.status}, created: ${record.createdAt.toISOString()})`)
    })
    
    // 批量更新为 'active'
    const result = await prisma.learningMaterial.updateMany({
      where: {
        status: {
          notIn: ['active', 'archived']
        }
      },
      data: {
        status: 'active'
      }
    })
    
    console.log(`\n✅ 成功修复 ${result.count} 条记录`)
  } else {
    console.log('✅ 没有需要修复的记录')
  }
}

main()
  .catch((e) => {
    console.error('❌ 修复失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
