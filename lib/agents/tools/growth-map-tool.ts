import { tool } from 'ai'
import { z } from 'zod'
import { generateGrowthMap } from '../plan-agent'
import { buildContextPack } from '../context-pack'
import { prisma } from '@/lib/db'

// 进度回调类型
type ProgressCallback = (step: string, status: 'running' | 'completed' | 'error') => void

export const createGrowthMapTool = tool({
  description: `Create a personalized growth/learning map for the user based on their goal. 
This will generate a structured learning path with stages/goals/tasks and store it in the database.

IMPORTANT: If you think research would help create a better learning plan, call the 'search_web' tool FIRST 
to gather relevant information, then pass the research results to this tool via the 'researchSummary' parameter.

Use this when the user expresses a learning goal or asks for a learning plan. 
Examples: "I want to learn React", "Help me become a data scientist", "Create a plan for learning Python".`,
  
  parameters: z.object({
    goal: z.string().describe('The user\'s learning goal or objective'),
    researchSummary: z.string().optional().describe('Optional research results from search_web tool to enhance the learning plan'),
  }),
  
  execute: async ({ goal, researchSummary, userId, onProgress, abortSignal }: { 
    goal: string
    researchSummary?: string
    userId?: string
    onProgress?: ProgressCallback
    abortSignal?: AbortSignal
  }) => {
    if (!userId) {
      throw new Error('userId is required but was not provided')
    }
    
    const reportProgress = (step: string, status: 'running' | 'completed' | 'error' = 'running') => {
      if (onProgress) {
        onProgress(step, status)
      }
    }

    try {
      // 1. 分析学习目标（v2.4: 不再创建 GrowthRequest）
      reportProgress('分析学习目标', 'running')
      const requestId = `req_${Date.now()}` // 临时 ID，仅用于日志
      reportProgress('分析学习目标', 'completed')

      // 2. Generate growth map (research is optional and should be called by AI if needed)
      reportProgress('生成学习路径', 'running')
      
      // 检查是否已中断
      if (abortSignal?.aborted) {
        throw new Error('Operation aborted by user')
      }
      
      const contextPack = await buildContextPack(userId)
      const mapData = await generateGrowthMap({
        userGoal: goal,
        contextPack,
        researchSummary, // AI 可以通过 search_web tool 获取并传入
        abortSignal,
      })
      reportProgress('生成学习路径', 'completed')

      // 4. Store growth map (v2.5: 扁平化 Goal，直接保存 Task 到 Stage)
      reportProgress('构建地图结构', 'running')
      
      // 扁平化：将所有 Goal 下的 Task 合并到 Stage
      const map = await prisma.growthMap.create({
        data: {
          userId,
          title: mapData.title,
          description: mapData.description,
          status: 'draft',
          stages: {
            create: mapData.stages.map((stage, sIdx) => {
              // 将 stage.goals 中的所有 tasks 扁平化
              const allTasks = stage.goals.flatMap((goal) => 
                goal.tasks.map((task) => task)
              )
              
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
      })

      // 5. 完成（v2.4: 不再更新 GrowthRequest 状态）
      reportProgress('构建地图结构', 'completed')

      return {
        success: true,
        mapId: map.id,
        title: mapData.title,
        description: mapData.description,
        status: 'draft', // 新生成的地图状态为 draft
        stages: mapData.stages,
        message: `已为你生成学习地图「${mapData.title}」，[点击查看完整地图](/plan/${map.id})`,
      }
    } catch (error) {
      const isAborted = error instanceof Error && 
        (error.message.includes('Operation aborted') || error.name === 'AbortError')
      
      reportProgress(isAborted ? '用户已中断' : '执行失败', 'error')
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create growth map',
      }
    }
  },
})
