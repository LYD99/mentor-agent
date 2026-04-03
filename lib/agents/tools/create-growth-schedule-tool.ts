import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateGrowthSchedule } from '../schedule-agent'
import { getGrowthMapContext } from '../growth-map-context'
import { progressBroadcaster } from '@/lib/storage/progress-broadcaster'

type ProgressCallback = (step: string, status: 'running' | 'completed' | 'error') => void

/**
 * 为成长地图创建定时学习计划
 * 该工具会调用 Plan Agent 生成每日学习计划，并配置定时任务
 */
export const createGrowthScheduleTool = tool({
  description: `Create a scheduled learning plan for a growth map. This tool will:
- Generate daily learning schedules based on the growth map
- Set up reminder tasks (e.g., daily study reminders, daily report reminders)
- Configure automatic summary tasks (e.g., weekly/monthly reports)
- Store all scheduled tasks in the database

Use this tool when:
- User has just created a growth map and wants to start executing it
- User mentions wanting daily reminders or learning schedules
- User asks to "implement the plan" or "start the learning schedule"
- User references an existing growth map and wants to create an execution plan

Examples:
- "Help me create a daily schedule for this growth map"
- "Set up reminders for my Python learning plan"
- "I want daily study reminders at 9am and report reminders at 9pm"`,

  parameters: z.object({
    mapId: z.string().describe('The ID of the growth map to create schedule for'),
    preferences: z.object({
      studyReminderTime: z.string().optional().describe('Time for daily study reminders (HH:mm format, e.g., "09:00")'),
      reportReminderTime: z.string().optional().describe('Time for daily report reminders (HH:mm format, e.g., "21:00")'),
      summaryTime: z.string().optional().describe('Time for daily summary generation (HH:mm format, e.g., "23:30")'),
      weeklyReportDay: z.number().optional().describe('Day of week for weekly reports (0=Sunday, 6=Saturday)'),
      monthlyReportDay: z.number().optional().describe('Day of month for monthly reports (1-28)'),
      timezone: z.string().optional().describe('User timezone (e.g., "Asia/Shanghai")'),
    }).optional().describe('User preferences for scheduling'),
  }),

  execute: async ({
    mapId,
    preferences = {},
    userId,
    onProgress,
    abortSignal,
  }: {
    mapId: string
    preferences?: {
      studyReminderTime?: string
      reportReminderTime?: string
      summaryTime?: string
      weeklyReportDay?: number
      monthlyReportDay?: number
      timezone?: string
    }
    userId?: string
    onProgress?: ProgressCallback
    abortSignal?: AbortSignal
  }, options?: { toolCallId?: string }) => {
    if (!userId) {
      throw new Error('userId is required but was not provided')
    }

    const toolCallId = options?.toolCallId
    
    const reportProgress = (step: string, status: 'running' | 'completed' | 'error' = 'running') => {
      if (onProgress) {
        onProgress(step, status)
      }
    }

    try {
      // 1. 验证地图存在且属于用户
      reportProgress('验证成长地图', 'running')
      const map = await prisma.growthMap.findFirst({
        where: {
          id: mapId,
          userId,
        },
        include: {
          stages: {
            include: {
              tasks: true,
            },
          },
        },
      })

      if (!map) {
        throw new Error('Growth map not found or access denied')
      }
      reportProgress('验证成长地图', 'completed')

      // 2. 获取地图完整上下文
      reportProgress('分析学习路径', 'running')
      const mapContext = await getGrowthMapContext(mapId)
      reportProgress('分析学习路径', 'completed')

      // 3. 调用 Schedule Agent 生成学习计划
      reportProgress('生成学习计划', 'running')
      
      // 收集阶段进度信息
      const stageProgress: Array<{
        stageIndex: number;
        stageTitle: string;
        status: 'pending' | 'running' | 'completed' | 'failed';
      }> = [];
      
      const scheduleData = await generateGrowthSchedule({
        mapId,
        mapContext,
        preferences: {
          studyReminderTime: preferences.studyReminderTime || '09:00',
          reportReminderTime: preferences.reportReminderTime || '21:00',
          summaryTime: preferences.summaryTime || '23:30',
          weeklyReportDay: preferences.weeklyReportDay ?? 0, // Sunday
          monthlyReportDay: preferences.monthlyReportDay ?? 1, // 1st of month
          timezone: preferences.timezone || 'Asia/Shanghai',
        },
        abortSignal,
        onStageProgress: async (stage) => {
          // 查找是否已存在该阶段
          const existingIndex = stageProgress.findIndex(
            s => s.stageIndex === stage.stageIndex
          );
          
          if (existingIndex >= 0) {
            // 更新已存在的阶段
            stageProgress[existingIndex] = {
              stageIndex: stage.stageIndex,
              stageTitle: stage.stageTitle,
              status: stage.status,
            };
          } else {
            // 添加新阶段
            stageProgress.push({
              stageIndex: stage.stageIndex,
              stageTitle: stage.stageTitle,
              status: stage.status,
            });
          }
          
          const currentProgress = [...stageProgress];
          
          // v2.4: 不再更新 ToolCallExecution（表已移除）
          // 进度通过 SSE 实时推送给前端
          if (toolCallId) {
            try {
              // 通过 progressBroadcaster 推送进度（保留）
              const { progressBroadcaster } = await import('@/lib/storage/progress-broadcaster')
              progressBroadcaster.pushProgress(toolCallId, {
                type: 'stage_progress',
                stageProgress: currentProgress,
              })
            } catch (error) {
              console.error('Failed to broadcast stage progress:', error);
            }
            
            // 通过 SSE 实时推送进度更新
            progressBroadcaster.pushProgress(toolCallId, {
              type: 'stage_progress',
              stageProgress: currentProgress,
            });
          }
          
          // 实时报告阶段进度到前端
          const statusText = stage.status === 'running' ? '生成中' : 
                            stage.status === 'completed' ? '已完成' : 
                            stage.status === 'failed' ? '失败' : '等待中';
          reportProgress(
            `阶段 ${stage.stageIndex + 1}/${stage.totalStages}: ${stage.stageTitle}`,
            stage.status === 'running' ? 'running' : 
            stage.status === 'completed' ? 'completed' : 'error'
          );
          
          console.log(`[SSE Push] Stage ${stage.stageIndex + 1}/${stage.totalStages} "${stage.stageTitle}": ${stage.status}`);
        },
      })
      reportProgress('生成学习计划', 'completed')

      // 4. 删除该地图的旧定时任务
      reportProgress('配置定时任务', 'running')
      await prisma.scheduledTask.deleteMany({
        where: {
          mapId,
          userId,
        },
      })

      // 5. 创建新的定时任务
      const tasks = await prisma.scheduledTask.createMany({
        data: scheduleData.scheduledTasks.map((task) => ({
          mapId,
          userId,
          taskType: task.taskType,
          cronExpression: task.cronExpression,
          contentJson: JSON.stringify(task.content),
          status: 'learning',
        })),
      })

      reportProgress('配置定时任务', 'completed')

      // v2.5: 保存学习计划到 DailyPlan 表并更新地图状态
      // 删除旧的计划
      await prisma.dailyPlan.deleteMany({
        where: { mapId },
      })
      
      // 创建新的每日计划
      if (scheduleData.dailySchedule && scheduleData.dailySchedule.length > 0) {
        await prisma.dailyPlan.createMany({
          data: scheduleData.dailySchedule.flatMap((day: any) => 
            day.tasks.map((task: any) => ({
              mapId,
              taskId: task.taskId,
              planDate: new Date(day.date),
              metadata: JSON.stringify({
                learningObjectives: task.learningObjectives,
                difficulty: task.difficulty,
                suggestedDuration: task.suggestedDuration,
                prerequisites: task.prerequisites,
                focusAreas: task.focusAreas,
              }),
            }))
          ),
        })
      }
      
      // 更新地图状态为 planned
      await prisma.growthMap.update({
        where: { id: mapId },
        data: {
          status: 'planned',
        },
      })

      return {
        success: true,
        mapId,
        message: `已为「${map.title}」创建学习计划`,
        stageProgress: stageProgress.filter(s => s.status === 'completed' || s.status === 'failed'),
        schedule: {
          totalDays: scheduleData.dailySchedule.length,
          studyReminders: scheduleData.dailySchedule.map((s) => ({
            date: s.date,
            tasks: s.tasks,
            reminderTime: preferences.studyReminderTime || '09:00',
          })),
          reportReminder: {
            time: preferences.reportReminderTime || '21:00',
            description: '每天提醒你写学习日报',
          },
          autoSummary: {
            time: preferences.summaryTime || '23:30',
            description: '每天自动总结学习进度',
          },
          weeklyReport: {
            day: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][preferences.weeklyReportDay ?? 0],
            description: '每周生成学习周报',
          },
          monthlyReport: {
            day: preferences.monthlyReportDay ?? 1,
            description: '每月生成学习月报',
          },
          totalTasks: tasks.count,
        },
        details: `
已创建 ${tasks.count} 个定时任务：

📅 **每日学习提醒**
- 时间：每天 ${preferences.studyReminderTime || '09:00'}
- 内容：根据学习计划提醒你当天的学习任务，并生成学习资料和练习题

📝 **每日日报提醒**
- 时间：每天 ${preferences.reportReminderTime || '21:00'}
- 内容：提醒你写学习日报，记录今天的学习收获

🤖 **每日自动总结**
- 时间：每天 ${preferences.summaryTime || '23:30'}
- 内容：自动分析你的学习进度，生成学习总结

📊 **每周学习周报**
- 时间：每周${['日', '一', '二', '三', '四', '五', '六'][preferences.weeklyReportDay ?? 0]} 生成
- 内容：汇总本周学习情况，分析进度和问题

📈 **每月学习月报**
- 时间：每月 ${preferences.monthlyReportDay ?? 1} 号生成
- 内容：总结本月学习成果，提供改进建议

[查看完整学习计划](/plan/${mapId})
        `.trim(),
      }
    } catch (error) {
      const isAborted = error instanceof Error && 
        (error.message.includes('Operation aborted') || error.name === 'AbortError')
      
      reportProgress(isAborted ? '用户已中断' : '执行失败', 'error')
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create growth schedule',
      }
    }
  },
})
