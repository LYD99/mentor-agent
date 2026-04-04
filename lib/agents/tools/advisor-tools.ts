import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { researchTool } from './research-tool'
import { generateLessonTool } from './generate-lesson-tool'
import { ragRetrieveTool } from './rag-tools'

/**
 * Advisor 专用学情工具
 * 用于获取任务相关的学习详情，包括讲义状态、练习记录等
 */

export function getTaskLearningDetailTool() {
  return tool({
    description: `Get detailed learning information for a specific task, including:
- Task progress and status
- Associated lessons and reading progress
- Recent learning activities
- Exercise results (if any)
Use this when the user asks about their progress on a specific task or needs context about what they've learned.`,
    parameters: z.object({
      taskId: z.string().describe('The ID of the task to get learning details for'),
    }),
    execute: async ({ taskId, userId }: { taskId: string; userId?: string }) => {
      if (!userId) {
        throw new Error('userId is required but was not injected')
      }

      // v2.5: 获取任务信息（LearningTask 直接属于 Stage）
      const task = await prisma.learningTask.findUnique({
        where: { id: taskId },
        include: {
          stage: {
            include: {
              map: true,
            },
          },
        },
      })

      if (!task) {
        return {
          error: 'Task not found or access denied',
        }
      }

      // 验证用户权限
      if (task.stage.map.userId !== userId) {
        return {
          error: 'Task not found or access denied',
        }
      }

      // 2. 获取学习资料信息（从 LearningMaterial 表查询）
      const materials = await prisma.learningMaterial.findMany({
        where: {
          userId,
          mapId: task.stage.mapId,
          // LearningMaterial 没有 taskId 字段，无法精确匹配任务
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      })
      
      const lessonInfo = materials[0]
        ? {
            id: materials[0].id,
            title: materials[0].title,
            contentPreview: materials[0].contentMarkdown.slice(0, 300) + '...',
            hasFullContent: true,
          }
        : null

      // 3. 获取相关会话（Advisor 会话）
      const recentSessions = await prisma.chatSession.findMany({
        where: {
          userId,
          channel: 'advisor',
          taskId,
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 3,
        select: {
          id: true,
          title: true,
          messageCount: true,
          lastMessageAt: true,
        },
      })

      return {
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          type: task.type,
          status: task.status,
          completedAt: task.completedAt,
          durationDays: task.durationDays,
        },
        context: {
          stage: task.stage.title,
          map: task.stage.map.title,
        },
        lesson: lessonInfo,
        recentSessions: recentSessions.map((s) => ({
          id: s.id,
          title: s.title,
          messageCount: s.messageCount,
          lastMessageAt: s.lastMessageAt,
        })),
        summary: `Task "${task.title}" is currently ${task.status}. ${
          lessonInfo
            ? `A learning material is available: "${lessonInfo.title}".`
            : 'No learning material has been generated yet.'
        } ${
          recentSessions.length > 0
            ? `User has ${recentSessions.length} previous advisor session(s) on this task.`
            : 'This is the first advisor session for this task.'
        }`,
      }
    },
  })
}

export function listRecentLearningEventsTool() {
  return tool({
    description: `List recent learning events and activities for the user, such as:
- Lesson opens and reading progress
- Exercise submissions
- Task status changes
- Daily report submissions
Use this to understand what the user has been working on recently.`,
    parameters: z.object({
      taskId: z.string().optional().describe('Filter by specific task ID'),
      mapId: z.string().optional().describe('Filter by specific growth map ID'),
      limit: z.number().optional().default(10).describe('Maximum number of events to return'),
    }),
    execute: async ({
      taskId,
      mapId,
      limit = 10,
      userId,
    }: {
      taskId?: string
      mapId?: string
      limit?: number
      userId?: string
    }) => {
      if (!userId) {
        throw new Error('userId is required but was not injected')
      }

      // 基于现有数据构建学习事件流
      // 数据源：ChatSession、LearningTask、LearningMaterial
      
      const events: Array<{
        eventType: string
        timestamp: Date
        taskTitle?: string
        lessonTitle?: string
        description: string
        relatedId?: string
      }> = []

      // 1. 获取学习资料创建事件
      const materialWhereClause: any = { userId }
      if (taskId) materialWhereClause.taskId = taskId
      if (mapId) materialWhereClause.mapId = mapId

      const materials = await prisma.learningMaterial.findMany({
        where: materialWhereClause,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit * 2, 20), // 多取一些，后面会合并排序
      })

      materials.forEach((m) => {
        events.push({
          eventType: 'material_created',
          timestamp: m.createdAt,
          lessonTitle: m.title,
          description: `创建学习资料: ${m.title}`,
          relatedId: m.id,
        })
      })

      // 2. 获取最近的 Advisor 会话
      const sessionWhereClause: any = {
        userId,
        channel: 'advisor',
      }
      if (taskId) sessionWhereClause.taskId = taskId
      if (mapId) sessionWhereClause.growthMapId = mapId

      const sessions = await prisma.chatSession.findMany({
        where: sessionWhereClause,
        orderBy: { lastMessageAt: 'desc' },
        take: Math.min(limit, 10),
      })

      sessions.forEach((s) => {
        if (s.lastMessageAt) {
          events.push({
            eventType: 'advisor_session',
            timestamp: s.lastMessageAt,
            description: `Advisor 会话: ${s.title || 'Untitled'} (${s.messageCount} 条消息)`,
            relatedId: s.id,
          })
        }
      })

      // 3. 获取任务完成事件
      const taskWhereClause: any = { 
        completedAt: { not: null },
      }
      if (taskId) {
        taskWhereClause.id = taskId
      } else if (mapId) {
        // 通过 stage 关联查询
        const stages = await prisma.growthStage.findMany({
          where: { mapId },
          select: { id: true },
        })
        if (stages.length > 0) {
          taskWhereClause.stageId = { in: stages.map(s => s.id) }
        }
      }

      const completedTasks = await prisma.learningTask.findMany({
        where: taskWhereClause,
        orderBy: { completedAt: 'desc' },
        take: Math.min(limit, 10),
      })

      completedTasks.forEach((task) => {
        if (task.completedAt) {
          events.push({
            eventType: 'task_completed',
            timestamp: task.completedAt,
            taskTitle: task.title,
            description: `完成任务: ${task.title}`,
            relatedId: task.id,
          })
        }
      })

      // 4. 按时间排序并限制数量
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      const limitedEvents = events.slice(0, limit)

      return {
        events: limitedEvents.map((e) => ({
          eventType: e.eventType,
          timestamp: e.timestamp.toISOString(),
          taskTitle: e.taskTitle,
          lessonTitle: e.lessonTitle,
          description: e.description,
          relatedId: e.relatedId,
        })),
        total: limitedEvents.length,
        hasMore: events.length > limit,
      }
    },
  })
}

/**
 * 搜索用户导入的学习资料
 */
function searchUserMaterialsTool() {
  return tool({
    description: `搜索用户导入的学习资料。
    
使用场景：
- 用户想查找之前导入的学习资料
- 需要引用用户自己的笔记或文档
- 根据关键词搜索相关资料

输入参数：
- query: 搜索关键词（必需）
- folderId: 文件夹 ID（可选，用于限定搜索范围）
- limit: 返回结果数量（可选，默认 10）

输出：
- 匹配的学习资料列表，包含标题、内容摘要、创建时间等`,

    parameters: z.object({
      query: z.string().describe('搜索关键词，例如："React Hooks"、"算法"'),
      folderId: z.string().optional().describe('文件夹 ID（可选）'),
      limit: z.number().optional().default(10).describe('返回结果数量，默认 10'),
    }),

    execute: async ({ query, folderId, limit = 10 }, context?: { userId?: string }) => {
      const userId = context?.userId
      if (!userId) {
        throw new Error('userId is required but was not injected')
      }

      try {
        // 构建查询条件
        const whereClause: any = {
          userId,
          status: 'active',
          OR: [
            { title: { contains: query } },
            { contentMarkdown: { contains: query } },
          ],
        }

        // 如果指定了文件夹，添加过滤
        if (folderId) {
          whereClause.folderId = folderId
        }

        // 查询资料
        const materials = await prisma.learningMaterial.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: {
            id: true,
            title: true,
            contentMarkdown: true,
            type: true,
            source: true,
            folderId: true,
            tags: true,
            createdAt: true,
          },
        })

        // 格式化结果
        const results = materials.map((m) => ({
          id: m.id,
          title: m.title,
          type: m.type,
          source: m.source,
          summary: m.contentMarkdown.slice(0, 200) + (m.contentMarkdown.length > 200 ? '...' : ''),
          tags: m.tags ? JSON.parse(m.tags) : [],
          createdAt: m.createdAt.toISOString(),
          folderId: m.folderId,
        }))

        return {
          success: true,
          query,
          total: results.length,
          materials: results,
          message: results.length > 0
            ? `找到 ${results.length} 份相关资料`
            : '未找到相关资料',
        }
      } catch (error) {
        console.error('[Search User Materials] Error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          message: '搜索失败',
        }
      }
    },
  })
}

export const advisorTools = {
  get_task_learning_detail: getTaskLearningDetailTool(),
  list_recent_learning_events: listRecentLearningEventsTool(),
  generate_lesson: generateLessonTool,
  search_web: researchTool,
  search_user_materials: searchUserMaterialsTool(),
  rag_retrieve: ragRetrieveTool(),
}
