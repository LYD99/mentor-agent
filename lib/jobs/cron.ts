import cron from 'node-cron'
import { prisma } from '@/lib/db'
import { generateDailyLesson } from './handlers/daily-lesson'
import { sendReportReminder } from './handlers/report-reminder'
import { generateDailySummary } from './handlers/daily-summary'
import { generateWeeklyReport } from './handlers/weekly-report'
import { generateMonthlyReport } from './handlers/monthly-report'

interface ScheduledTaskHandler {
  (task: {
    id: string
    mapId: string
    userId: string
    contentJson: string | null
  }): Promise<void>
}

const taskHandlers: Record<string, ScheduledTaskHandler> = {
  daily_study_reminder: generateDailyLesson,
  daily_report_reminder: sendReportReminder,
  daily_auto_summary: generateDailySummary,
  weekly_report: generateWeeklyReport,
  monthly_report: generateMonthlyReport,
}

/**
 * 执行定时任务
 */
async function executeScheduledTask(task: {
  id: string
  mapId: string
  userId: string
  taskType: string
  contentJson: string | null
}) {
  const handler = taskHandlers[task.taskType]
  if (!handler) {
    console.error(`[Cron] No handler found for task type: ${task.taskType}`)
    return
  }

  try {
    console.log(`[Cron] Executing ${task.taskType} for user ${task.userId}`)
    await handler(task)
    console.log(`[Cron] Successfully executed ${task.taskType}`)
  } catch (error) {
    console.error(`[Cron] Error executing ${task.taskType}:`, error)
  }
}

/**
 * 动态加载和调度所有活跃的定时任务
 */
async function loadAndScheduleTasks() {
  const tasks = await prisma.scheduledTask.findMany({
    where: {
      status: 'learning',
    },
  })

  console.log(`[Cron] Loading ${tasks.length} scheduled tasks...`)

  // 按 cron 表达式分组任务
  const cronGroups = new Map<string, typeof tasks>()
  for (const task of tasks) {
    const existing = cronGroups.get(task.cronExpression) || []
    existing.push(task)
    cronGroups.set(task.cronExpression, existing)
  }

  // 为每个唯一的 cron 表达式创建调度器
  for (const [cronExpr, groupTasks] of cronGroups.entries()) {
    try {
      cron.schedule(cronExpr, async () => {
        console.log(`[Cron] Triggered: ${cronExpr} (${groupTasks.length} tasks)`)
        for (const task of groupTasks) {
          await executeScheduledTask(task)
        }
      })
      console.log(`[Cron] Scheduled: ${cronExpr} (${groupTasks.length} tasks)`)
    } catch (error) {
      console.error(`[Cron] Invalid cron expression: ${cronExpr}`, error)
    }
  }
}

/**
 * 启动定时任务系统
 */
export async function startCronJobs() {
  console.log('[Cron] Starting cron job system...')

  // 加载并调度所有任务
  await loadAndScheduleTasks()

  // 每小时重新加载任务（以支持动态添加的任务）
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Reloading scheduled tasks...')
    await loadAndScheduleTasks()
  })

  console.log('✅ Cron jobs started')
}

/**
 * 手动触发特定任务（用于测试）
 */
export async function triggerTask(taskId: string) {
  const task = await prisma.scheduledTask.findUnique({
    where: { id: taskId },
  })

  if (!task) {
    throw new Error('Task not found')
  }

  if (task.status !== 'learning') {
    throw new Error('Task is not active')
  }

  await executeScheduledTask(task)
}
