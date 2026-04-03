import { prisma } from '@/lib/db'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { getEnv } from '@/lib/config/env-runtime'

const WeeklyReportSchema = z.object({
  summary: z.string().describe('Overall summary of this week\'s learning'),
  highlights: z.array(z.string()).describe('Key highlights of the week'),
  metrics: z.object({
    totalTasks: z.number(),
    completedTasks: z.number(),
    totalMaterials: z.number(),
    estimatedHours: z.number(),
    consistencyScore: z.number().describe('0-100, how consistent was the learning'),
  }),
  progress: z.string().describe('Progress assessment'),
  challenges: z.array(z.string()).describe('Main challenges faced this week'),
  recommendations: z.array(z.string()).describe('Recommendations for next week'),
})

/**
 * 每周学习周报处理器
 */
export async function generateWeeklyReport(task: {
  id: string
  mapId: string
  userId: string
  contentJson: string | null
}) {
  try {
    // 计算本周的起止日期
    const now = new Date()
    const dayOfWeek = now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    weekEnd.setHours(23, 59, 59, 999)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    // 收集本周的学习数据
    const [weekMaterials, weekTasks, dailyReports] = await Promise.all([
      // 本周的学习资料
      prisma.learningMaterial.findMany({
        where: {
          userId: task.userId,
          mapId: task.mapId,
          createdAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // v2.5: 本周完成的任务（LearningTask 直接属于 Stage）
      prisma.learningTask.findMany({
        where: {
          stage: {
            mapId: task.mapId,
          },
          completedAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
        include: {
          stage: true,
        },
      }),
      // 本周的日报
      prisma.dailyReport.findMany({
        where: {
          userId: task.userId,
          mapId: task.mapId,
          reportDate: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
        orderBy: { reportDate: 'asc' },
      }),
    ])

    // 构建学习上下文
    const learningContext = `
Week: ${weekStartStr} to ${weekEndStr}

Learning Materials (${weekMaterials.length}):
${weekMaterials.map((m, i) => `${i + 1}. [${m.type}] ${m.title}\n   Date: ${m.createdAt.toISOString().split('T')[0]}`).join('\n')}

Completed Tasks (${weekTasks.length}):
${weekTasks.map((t, i) => `${i + 1}. ${t.title}\n   Stage: ${t.stage.title}\n   Completed: ${t.completedAt?.toISOString().split('T')[0]}`).join('\n')}

Daily Reports (${dailyReports.length}/7 days):
${dailyReports.map((r, i) => `${i + 1}. ${r.reportDate.toISOString().split('T')[0]} - ${r.title}\n   Type: ${r.type}`).join('\n')}
    `.trim()

    // 使用 AI 生成周报
    const apiKey = getEnv('AI_API_KEY')
    if (!apiKey?.trim()) {
      throw new Error('Missing AI_API_KEY')
    }

    const openaiProvider = createOpenAI({
      apiKey,
      baseURL: getEnv('AI_BASE_URL') ?? getEnv('OPENAI_BASE_URL'),
    })

    const { object: reportData } = await generateObject({
      model: openaiProvider(getEnv('AI_MODEL') || 'gpt-4o-mini'),
      schema: WeeklyReportSchema,
      prompt: `Analyze the following weekly learning data and generate a comprehensive weekly report.

${learningContext}

Generate a report that:
1. Summarizes the week's learning activities
2. Highlights key achievements and milestones
3. Provides detailed metrics and progress assessment
4. Identifies challenges and areas for improvement
5. Offers actionable recommendations for next week

Be encouraging and provide constructive feedback. Focus on growth trends and patterns.`,
      temperature: 0.7,
    })

    // 生成 Markdown 格式的周报
    const reportMarkdown = `
# 📅 ${weekStartStr} ~ ${weekEndStr} 学习周报

## 📝 本周概况
${reportData.summary}

## ✨ 本周亮点
${reportData.highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

## 📊 学习数据
- **任务进度**: ${reportData.metrics.completedTasks}/${reportData.metrics.totalTasks} 个任务完成
- **学习资料**: ${reportData.metrics.totalMaterials} 份
- **学习时长**: 约 ${reportData.metrics.estimatedHours} 小时
- **坚持度**: ${reportData.metrics.consistencyScore}/100 分

## 📈 进度评估
${reportData.progress}

## 💪 本周挑战
${reportData.challenges.length > 0 ? reportData.challenges.map((c, i) => `${i + 1}. ${c}`).join('\n') : '本周学习顺利，没有遇到明显的困难！'}

## 💡 下周建议
${reportData.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---
*本周报由 AI 自动生成于 ${new Date().toLocaleString('zh-CN')}*
    `.trim()

    // 保存周报
    await prisma.weeklyReport.create({
      data: {
        userId: task.userId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        type: 'ai_generated',
        title: `${weekStartStr} ~ ${weekEndStr} 学习周报`,
        contentMarkdown: reportMarkdown,
        summaryJson: JSON.stringify(reportData),
        mapId: task.mapId,
        highlights: JSON.stringify(reportData.highlights),
        metrics: JSON.stringify(reportData.metrics),
      },
    })

    console.log('[Weekly Report] Generated report for week', weekStartStr)
  } catch (error) {
    console.error('[Weekly Report] Error:', error)
    throw error
  }
}
