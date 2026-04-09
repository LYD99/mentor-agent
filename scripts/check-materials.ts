import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('检查学习资料状态...\n')
  
  // 查询最近的学习资料
  const materials = await prisma.learningMaterial.findMany({
    where: {
      type: 'daily_lesson',
    },
    select: {
      id: true,
      title: true,
      mapId: true,
      taskId: true,
      dailyPlanId: true,
      createdAt: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  
  console.log(`最近的 ${materials.length} 条学习资料：\n`)
  
  for (const m of materials) {
    console.log(`📚 ${m.title}`)
    console.log(`   ID: ${m.id}`)
    console.log(`   状态: ${m.status}`)
    console.log(`   创建时间: ${m.createdAt.toISOString()}`)
    console.log(`   mapId: ${m.mapId || '无'}`)
    console.log(`   taskId: ${m.taskId || '无'}`)
    console.log(`   dailyPlanId: ${m.dailyPlanId || '无'}`)
    
    // 如果有 mapId 和 taskId，查找对应的 DailyPlan
    if (m.mapId && m.taskId && !m.dailyPlanId) {
      const plans = await prisma.dailyPlan.findMany({
        where: {
          mapId: m.mapId,
          taskId: m.taskId,
        },
        select: {
          id: true,
          planDate: true,
        },
        take: 3,
      })
      
      if (plans.length > 0) {
        console.log(`   ⚠️  找到 ${plans.length} 个匹配的计划，但未关联：`)
        plans.forEach(p => {
          console.log(`      - ${p.planDate.toISOString().split('T')[0]} (${p.id})`)
        })
      }
    }
    
    console.log('')
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
