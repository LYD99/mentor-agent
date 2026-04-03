import { prisma } from '@/lib/db'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { getEnv } from '@/lib/config/env-runtime'

const MonthlyReportSchema = z.object({
  summary: z.string().describe('Overall summary of this month\'s learning'),
  achievements: z.array(z.string()).describe('Major achievements this month'),
  insights: z.array(z.string()).describe('Key insights and learnings'),
  metrics: z.object({
    totalTasks: z.number(),
    completedTasks: z.number(),
    totalMaterials: z.number(),
    estimatedHours: z.number(),
    averageConsistency: z.number().describe('Average consistency score'),
    completionRate: z.number().describe('Task completion rate percentage'),
  }),
  progress: z.string().describe('Overall progress assessment'),
  challenges: z.array(z.string()).describe('Main challenges faced this month'),
  recommendations: z.array(z.string()).describe('Recommendations for next month'),
  milestones: z.array(z.string()).describe('Important milestones reached'),
})

/**
 * 每月学习月报处理器
 */
export async function generateMonthlyReport(task: {
  id: string
  mapId: string
  userId: string
  contentJson: string | null
}) {
  try {
    // 计算本月的起止日期
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    
    const monthStart = new Date(year, now.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    
    const monthEnd = new Date(year, now.getMonth() + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)

    const monthStartStr = monthStart.toISOString().split('T')[0]
    const monthEndStr = monthEnd.toISOString().split('T')[0]

    // 收集本月的学习数据
    const [monthMaterials, monthTasks, dailyReports, weeklyReports] = await Promise.all([
      // 本月的学习资料
      prisma.learningMaterial.findMany({
        where: {
          userId: task.userId,
          mapId: task.mapId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // v2.5: 本月完成的任务（LearningTask 直接属于 Stage）
      prisma.learningTask.findMany({
        where: {
          stage: {
            mapId: task.mapId,
          },
          completedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        include: {
          stage: true,
        },
      }),
      // 本月的日报
      prisma.dailyReport.findMany({
        where: {
          userId: task.userId,
          mapId: task.mapId,
          reportDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        orderBy: { reportDate: 'asc' },
      }),
      // 本月的周报
      prisma.weeklyReport.findMany({
        where: {
          userId: task.userId,
          mapId: task.mapId,
          weekStartDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        orderBy: { weekStartDate: 'asc' },
      }),
    ])

    // 构建学习上下文
    const learningContext = `
Month: ${year}-${month.toString().padStart(2, '0')} (${monthStartStr} to ${monthEndStr})

Learning Materials (${monthMaterials.length}):
${monthMaterials.slice(0, 20).map((m, i) => `${i + 1}. [${m.type}] ${m.title}\n   Date: ${m.createdAt.toISOString().split('T')[0]}`).join('\n')}
${monthMaterials.length > 20 ? `... and ${monthMaterials.length - 20} more` : ''}

Completed Tasks (${monthTasks.length}):
${monthTasks.map((t, i) => `${i + 1}. ${t.title}\n   Stage: ${t.stage.title}\n   Completed: ${t.completedAt?.toISOString().split('T')[0]}`).join('\n')}

Daily Reports: ${dailyReports.length} days
Weekly Reports: ${weeklyReports.length} weeks

Weekly Summaries:
${weeklyReports.map((w, i) => {
  const summary = w.summaryJson ? JSON.parse(w.summaryJson) : {}
  return `Week ${i + 1}: ${w.weekStartDate.toISOString().split('T')[0]}\n   Summary: ${summary.summary || 'N/A'}`
}).join('\n')}
    `.trim()

    // 使用 AI 生成月报
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
      schema: MonthlyReportSchema,
      prompt: `Analyze the following monthly learning data and generate a comprehensive monthly report.

${learningContext}

Generate a report that:
1. Provides a high-level summary of the month's learning journey
2. Highlights major achievements and milestones
3. Extracts key insights and learnings
4. Presents detailed metrics and progress trends
5. Identifies persistent challenges and growth areas
6. Offers strategic recommendations for next month

Be reflective and forward-looking. Focus on growth patterns, breakthroughs, and long-term progress.`,
      temperature: 0.7,
    })

    // 生成 Markdown 格式的月报
    const reportMarkdown = `
# 📆 ${year}年${month}月 学习月报

## 📝 本月概况
${reportData.summary}

## 🏆 本月成就
${reportData.achievements.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## 🎯 重要里程碑
${reportData.milestones.length > 0 ? reportData.milestones.map((m, i) => `${i + 1}. ${m}`).join('\n') : '继续努力，下个月会有更多突破！'}

## 💡 关键洞察
${reportData.insights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

## 📊 学习数据
- **任务进度**: ${reportData.metrics.completedTasks}/${reportData.metrics.totalTasks} 个任务完成 (${reportData.metrics.completionRate.toFixed(1)}%)
- **学习资料**: ${reportData.metrics.totalMaterials} 份
- **学习时长**: 约 ${reportData.metrics.estimatedHours} 小时
- **平均坚持度**: ${reportData.metrics.averageConsistency.toFixed(1)}/100 分

## 📈 进度评估
${reportData.progress}

## 💪 本月挑战
${reportData.challenges.length > 0 ? reportData.challenges.map((c, i) => `${i + 1}. ${c}`).join('\n') : '本月学习顺利，没有遇到明显的困难！'}

## 💡 下月建议
${reportData.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---
*本月报由 AI 自动生成于 ${new Date().toLocaleString('zh-CN')}*
    `.trim()

    // 保存月报
    await prisma.monthlyReport.create({
      data: {
        userId: task.userId,
        year,
        month,
        type: 'ai_generated',
        title: `${year}年${month}月学习月报`,
        contentMarkdown: reportMarkdown,
        summaryJson: JSON.stringify(reportData),
        mapId: task.mapId,
        achievements: JSON.stringify(reportData.achievements),
        insights: JSON.stringify(reportData.insights),
        metrics: JSON.stringify(reportData.metrics),
      },
    })

    console.log('[Monthly Report] Generated report for', year, month)
  } catch (error) {
    console.error('[Monthly Report] Error:', error)
    throw error
  }
}
