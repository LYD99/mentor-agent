import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('修复缺失的 taskId...\n')
  
  // 查找有 mapId 但没有 taskId 的学习资料
  const materials = await prisma.learningMaterial.findMany({
    where: {
      mapId: { not: null },
      taskId: null,
      type: 'daily_lesson',
    },
    select: {
      id: true,
      title: true,
      mapId: true,
      createdAt: true,
    },
  })
  
  console.log(`找到 ${materials.length} 条需要修复的资料\n`)
  
  if (materials.length === 0) {
    console.log('✅ 所有资料都有 taskId')
    return
  }
  
  let successCount = 0
  let failCount = 0
  
  for (const material of materials) {
    try {
      const createdDate = material.createdAt.toISOString().split('T')[0]
      
      // 查找该地图在创建日期前后3天内的所有计划
      const dailyPlans = await prisma.dailyPlan.findMany({
        where: {
          mapId: material.mapId!,
          planDate: {
            gte: new Date(new Date(createdDate).getTime() - 3 * 24 * 60 * 60 * 1000),
            lte: new Date(new Date(createdDate).getTime() + 3 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          planDate: 'asc',
        },
      })
      
      if (dailyPlans.length > 0) {
        // 使用标题匹配找到最相关的任务
        let bestMatch = dailyPlans[0]
        
        // 获取所有任务信息
        const taskIds = dailyPlans.map(p => p.taskId)
        const tasks = await prisma.learningTask.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, title: true },
        })
        
        // 尝试通过标题匹配
        for (const plan of dailyPlans) {
          const task = tasks.find(t => t.id === plan.taskId)
          if (task && material.title.includes(task.title)) {
            bestMatch = plan
            break
          }
        }
        
        // 更新资料，关联 taskId 和 dailyPlanId
        await prisma.learningMaterial.update({
          where: { id: material.id },
          data: {
            taskId: bestMatch.taskId,
            dailyPlanId: bestMatch.id,
          },
        })
        
        const task = tasks.find(t => t.id === bestMatch.taskId)
        console.log(`✅ ${material.title}`)
        console.log(`   关联任务: ${task?.title || bestMatch.taskId}`)
        console.log(`   计划日期: ${bestMatch.planDate.toISOString().split('T')[0]}`)
        successCount++
      } else {
        console.log(`⚠️  ${material.title}`)
        console.log(`   未找到匹配的学习计划`)
        failCount++
      }
    } catch (error) {
      console.error(`❌ 处理失败: ${material.title}`, error)
      failCount++
    }
  }
  
  console.log(`\n完成！`)
  console.log(`✅ 成功修复: ${successCount} 条`)
  if (failCount > 0) {
    console.log(`⚠️  失败/未找到: ${failCount} 条`)
  }
}

main()
  .catch((e) => {
    console.error('❌ 执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
