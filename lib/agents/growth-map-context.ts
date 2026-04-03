import { prisma } from '@/lib/db'

/**
 * 获取成长地图的结构化内容，用于注入到对话上下文中
 */
export async function getGrowthMapContext(mapId: string): Promise<string> {
  // v2.5: GrowthMap 查询（移除 scheduledTasks include，需要单独查询）
  const map = await prisma.growthMap.findUnique({
    where: { id: mapId },
    include: {
      stages: {
        orderBy: { stageOrder: 'asc' },
        include: {
          tasks: {
            orderBy: { taskOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!map) {
    return ''
  }

  let context = `# 成长地图: ${map.title}\n\n`
  
  if (map.description) {
    context += `${map.description}\n\n`
  }

  context += `状态: ${map.status}\n\n`

  // v2.5: 学习计划信息已移至 DailyPlan 和 ScheduledTask 表，暂时跳过
  // TODO: 如需显示学习计划，需要单独查询 DailyPlan 和 ScheduledTask 表

  // 添加地图结构
  context += `## 📚 学习路径\n\n`

  // v2.5: 扁平化结构，tasks 直接属于 stage
  map.stages.forEach((stage, sIdx) => {
    context += `### 阶段 ${sIdx + 1}: ${stage.title}\n`
    if (stage.description) {
      context += `${stage.description}\n`
    }
    if (stage.durationWeeks) {
      context += `预计时长: ${stage.durationWeeks} 周\n`
    }
    context += '\n'

    if (stage.tasks.length > 0) {
      context += '**任务列表:**\n'
      stage.tasks.forEach((task, tIdx) => {
        context += `${tIdx + 1}. **${task.title}** (${task.type}, ${task.status})`
        if (task.durationDays) {
          context += ` - ${task.durationDays} 天`
        }
        context += '\n'
        if (task.description) {
          context += `   ${task.description}\n`
        }
      })
      context += '\n'
    }
  })

  return context
}

/**
 * 获取成长地图的简要信息（用于显示在 UI 上）
 */
export async function getGrowthMapSummary(mapId: string): Promise<{
  id: string
  title: string
  description: string | null
  status: string
} | null> {
  const map = await prisma.growthMap.findUnique({
    where: { id: mapId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
    },
  })

  return map
}
