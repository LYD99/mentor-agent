import { prisma } from '@/lib/db'

/**
 * 每日日报提醒处理器
 * 提醒用户写学习日报
 */
export async function sendReportReminder(task: {
  id: string
  mapId: string
  userId: string
  contentJson: string | null
}) {
  try {
    const content = task.contentJson ? JSON.parse(task.contentJson) : {}
    const today = new Date().toISOString().split('T')[0]

    // 检查今天是否已经写过日报
    const existingReport = await prisma.dailyReport.findFirst({
      where: {
        userId: task.userId,
        reportDate: new Date(today),
        type: 'user',
      },
    })

    if (existingReport) {
      console.log('[Report Reminder] User already wrote daily report today')
      return
    }

    // 获取今天的学习活动
    const todayStart = new Date(today)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const todayMaterials = await prisma.learningMaterial.findMany({
      where: {
        userId: task.userId,
        mapId: task.mapId,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    })

    // 创建提醒记录（可以扩展为发送通知、邮件等）
    const reminderContent = `
# 📝 学习日报提醒

今天是 ${today}，记得写学习日报哦！

## 今日学习概况
- 学习资料：${todayMaterials.length} 份
- 学习任务：${todayMaterials.filter(m => m.type === 'daily_lesson').length} 个

## 日报建议内容
1. 今天学了什么？
2. 有什么收获和心得？
3. 遇到了哪些困难？
4. 明天计划学什么？

[去写日报](/materials/new?type=daily_report&date=${today})
    `.trim()

    // 保存提醒为学习资料
    await prisma.learningMaterial.create({
      data: {
        userId: task.userId,
        type: 'ai_summary',
        title: `${today} - 日报提醒`,
        contentMarkdown: reminderContent,
        source: 'system',
        mapId: task.mapId,
        tags: JSON.stringify(['reminder', 'daily-report']),
      },
    })

    console.log('[Report Reminder] Sent reminder to user')
  } catch (error) {
    console.error('[Report Reminder] Error:', error)
    throw error
  }
}
