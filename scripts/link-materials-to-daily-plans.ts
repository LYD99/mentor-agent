import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始关联学习资料到每日计划...\n')
  
  // 查找所有有 mapId 和 taskId 但没有 dailyPlanId 的学习资料
  const materialsWithoutPlan = await prisma.learningMaterial.findMany({
    where: {
      mapId: { not: null },
      taskId: { not: null },
      dailyPlanId: null,
      type: 'daily_lesson',
    },
    select: {
      id: true,
      title: true,
      mapId: true,
      taskId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  
  console.log(`找到 ${materialsWithoutPlan.length} 条需要关联的学习资料\n`)
  
  if (materialsWithoutPlan.length === 0) {
    console.log('✅ 所有学习资料都已正确关联')
    return
  }
  
  let successCount = 0
  let failCount = 0
  
  for (const material of materialsWithoutPlan) {
    try {
      // 根据 mapId、taskId 和创建日期查找对应的 DailyPlan
      const createdDate = material.createdAt.toISOString().split('T')[0]
      
      // 尝试找到最接近的 DailyPlan
      const dailyPlan = await prisma.dailyPlan.findFirst({
        where: {
          mapId: material.mapId!,
          taskId: material.taskId!,
          planDate: {
            // 查找创建日期前后3天内的计划
            gte: new Date(new Date(createdDate).getTime() - 3 * 24 * 60 * 60 * 1000),
            lte: new Date(new Date(createdDate).getTime() + 3 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          planDate: 'asc',
        },
      })
      
      if (dailyPlan) {
        await prisma.learningMaterial.update({
          where: { id: material.id },
          data: { dailyPlanId: dailyPlan.id },
        })
        
        console.log(`✅ ${material.title}`)
        console.log(`   关联到计划日期: ${dailyPlan.planDate.toISOString().split('T')[0]}`)
        successCount++
      } else {
        console.log(`⚠️  ${material.title}`)
        console.log(`   未找到匹配的学习计划 (mapId: ${material.mapId}, taskId: ${material.taskId})`)
        failCount++
      }
    } catch (error) {
      console.error(`❌ 处理失败: ${material.title}`, error)
      failCount++
    }
  }
  
  console.log(`\n完成！`)
  console.log(`✅ 成功关联: ${successCount} 条`)
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
