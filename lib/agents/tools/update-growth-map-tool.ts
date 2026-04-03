import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateGrowthMap } from '../plan-agent'
import { buildContextPack } from '../context-pack'
import { parseModificationIntent, needsRegeneration } from './parse-modification'

/**
 * 修改成长地图工具
 * 允许用户对现有的成长地图进行修改，包括：
 * - 添加/删除阶段、目标或任务
 * - 修改标题、描述
 * - 调整学习时长
 * - 重新生成部分内容
 */
export const updateGrowthMapTool = tool({
  description: `Update or modify an existing growth map based on user's feedback. 
Use this when the user wants to:
- Add or remove stages, goals, or tasks
- Change titles, descriptions, or durations
- Adjust the learning path structure
- Regenerate specific parts of the map

Examples: 
- "Add a stage about advanced topics"
- "Remove the first task from stage 2"
- "Make the learning path shorter"
- "Add more practice exercises"
- "Change the title of the map"`,

  parameters: z.object({
    mapId: z.string().describe('The ID of the growth map to update'),
    modification: z.string().describe('Description of what changes the user wants to make'),
    regenerate: z.boolean().optional().describe('If true, regenerate the entire map with modifications applied'),
  }),

  execute: async ({
    mapId,
    modification,
    regenerate = false,
    userId,
    abortSignal,
  }: {
    mapId: string
    modification: string
    regenerate?: boolean
    userId?: string
    abortSignal?: AbortSignal
  }) => {
    if (!userId) {
      throw new Error('userId is required but was not provided')
    }

    try {
      // 1. 获取现有地图
      const existingMap = await prisma.growthMap.findUnique({
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

      if (!existingMap) {
        return {
          success: false,
          error: 'Growth map not found',
        }
      }

      // 验证权限
      if (existingMap.userId !== userId) {
        return {
          success: false,
          error: 'You do not have permission to modify this map',
        }
      }

      // 2. 解析修改意图
      const parsedModification = parseModificationIntent(modification)
      const shouldRegenerate = regenerate || needsRegeneration(parsedModification)

      // 3. 如果需要重新生成
      if (shouldRegenerate) {
        const contextPack = await buildContextPack(userId)
        
        // 构建修改指令
        const currentMapSummary = `
Current Map: ${existingMap.title}
${existingMap.description || ''}

Stages: ${existingMap.stages.length}
${existingMap.stages.map((s, i) => `${i + 1}. ${s.title} (${s.tasks.length} tasks)`).join('\n')}
`

        const modificationPrompt = `${currentMapSummary}

User's modification request: ${modification}

Please regenerate the growth map incorporating these changes.`

        // 重新生成地图
        const newMapData = await generateGrowthMap({
          userGoal: modificationPrompt,
          contextPack,
          researchSummary: '', // 跳过搜索，直接使用现有上下文
          abortSignal,
        })

        // 删除旧的阶段/目标/任务
        await prisma.growthStage.deleteMany({
          where: { mapId },
        })

        // v2.5: 更新地图并创建新结构（扁平化：将 goals 下的 tasks 直接放到 stage）
        const updatedMap = await prisma.growthMap.update({
          where: { id: mapId },
          data: {
            title: newMapData.title,
            description: newMapData.description,
            stages: {
              create: newMapData.stages.map((stage, sIdx) => {
                // 扁平化：将所有 goal 下的 tasks 合并到 stage 级别
                const allTasks = stage.goals.flatMap((goal) => goal.tasks || [])
                return {
                  stageOrder: sIdx,
                  title: stage.title,
                  description: stage.description,
                  durationWeeks: stage.durationWeeks,
                  tasks: {
                    create: allTasks.map((task, tIdx) => ({
                      taskOrder: tIdx,
                      title: task.title,
                      description: task.description,
                      type: task.type,
                      durationDays: task.durationDays,
                    })),
                  },
                }
              }),
            },
          },
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

        return {
          success: true,
          mapId: updatedMap.id,
          title: updatedMap.title,
          description: updatedMap.description,
          stages: updatedMap.stages,
          message: `已根据你的要求重新生成学习地图「${updatedMap.title}」，[点击查看](/plan/${updatedMap.id})`,
        }
      }

      // 4. 简单修改（不重新生成）
      // 根据解析的修改类型执行相应操作
      switch (parsedModification.type) {
        case 'add_stage':
          // 添加新阶段到末尾
          await prisma.growthStage.create({
            data: {
              mapId,
              stageOrder: existingMap.stages.length,
              title: '新阶段',
              description: `根据你的要求添加：${modification}`,
              durationWeeks: 2,
            },
          })
          return {
            success: true,
            mapId: existingMap.id,
            message: `已添加新阶段到学习地图，[点击查看](/plan/${mapId})。你可以在地图详情页中编辑阶段的具体内容。`,
          }

        case 'remove_stage':
          if (parsedModification.target?.stageIndex !== undefined) {
            const stageToRemove = existingMap.stages[parsedModification.target.stageIndex]
            if (stageToRemove) {
              await prisma.growthStage.delete({
                where: { id: stageToRemove.id },
              })
              return {
                success: true,
                mapId: existingMap.id,
                message: `已删除阶段「${stageToRemove.title}」，[点击查看](/plan/${mapId})`,
              }
            }
          }
          return {
            success: true,
            mapId: existingMap.id,
            message: `收到删除阶段的请求。请访问 [地图详情页](/plan/${mapId}) 选择要删除的具体阶段。`,
          }

        case 'update_title':
          // 提示用户在详情页修改
          return {
            success: true,
            mapId: existingMap.id,
            message: `要修改标题，请访问 [地图详情页](/plan/${mapId}) 进行编辑。`,
          }

        default:
          // 其他简单修改
          return {
            success: true,
            mapId: existingMap.id,
            message: `收到你的修改请求：「${modification}」。建议你访问 [地图详情页](/plan/${mapId}) 进行手动编辑，或者让我重新生成整个地图来应用这些修改。`,
            suggestion: 'regenerate',
          }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update growth map',
      }
    }
  },
})
