import { prisma } from '@/lib/db'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import { getEnv } from '@/lib/config/env-runtime'

const DailySummarySchema = z.object({
  summary: z.string().describe('Overall summary of today\'s learning'),
  achievements: z.array(z.string()).describe('What was accomplished today'),
  challenges: z.array(z.string()).describe('Challenges faced today'),
  progress: z.object({
    tasksCompleted: z.number(),
    timeSpent: z.number().describe('Estimated time in minutes'),
    materialsRead: z.number(),
  }),
  recommendations: z.array(z.string()).describe('Recommendations for tomorrow'),
})

/**
 * 每日自动总结处理器
 * 分析用户的学习进度，生成学习总结
 */
export async function generateDailySummary(task: {
  id: string
  mapId: string
  userId: string
  contentJson: string | null
}) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const todayStart = new Date(today)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    // 收集今天的学习数据
    const [todayMaterials, todayTasks, userReport] = await Promise.all([
      // 今天的学习资料
      prisma.learningMaterial.findMany({
        where: {
          userId: task.userId,
          mapId: task.mapId,
          createdAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      // v2.5: 今天完成的任务（LearningTask 直接属于 Stage）
      prisma.learningTask.findMany({
        where: {
          stage: {
            mapId: task.mapId,
          },
          completedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        include: {
          stage: true,
        },
      }),
      // 用户写的日报
      prisma.dailyReport.findFirst({
        where: {
          userId: task.userId,
          reportDate: new Date(today),
          type: 'user',
        },
      }),
    ])

    // 构建学习上下文
    const learningContext = `
Today's Date: ${today}

Learning Materials (${todayMaterials.length}):
${todayMaterials.map((m, i) => `${i + 1}. [${m.type}] ${m.title}\n   Created: ${m.createdAt.toISOString()}`).join('\n')}

Completed Tasks (${todayTasks.length}):
${todayTasks.map((t, i) => `${i + 1}. ${t.title}\n   Stage: ${t.stage.title}\n   Completed: ${t.completedAt?.toISOString()}`).join('\n')}

User's Daily Report:
${userReport ? userReport.contentMarkdown : 'User has not written a daily report yet.'}
    `.trim()

    // 使用 AI 生成总结
    const apiKey = getEnv('AI_API_KEY')
    if (!apiKey?.trim()) {
      throw new Error('Missing AI_API_KEY')
    }

    const openaiProvider = createOpenAI({
      apiKey,
      baseURL: getEnv('AI_BASE_URL') ?? getEnv('OPENAI_BASE_URL'),
    })

    const { object: summaryData } = await generateObject({
      model: openaiProvider(getEnv('AI_MODEL') || 'gpt-4o-mini'),
      schema: DailySummarySchema,
      prompt: `Analyze the following learning data and generate a comprehensive daily summary.

${learningContext}

Generate a summary that:
1. Highlights what the user accomplished today
2. Identifies challenges they faced
3. Provides progress metrics
4. Offers recommendations for tomorrow

Be encouraging and constructive. Focus on progress and growth.`,
      temperature: 0.7,
    })

    // 生成 Markdown 格式的总结
    const summaryMarkdown = `
# 📊 ${today} 学习总结

## 📝 今日概况
${summaryData.summary}

## 🎯 今日成就
${summaryData.achievements.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## 💪 遇到的挑战
${summaryData.challenges.length > 0 ? summaryData.challenges.map((c, i) => `${i + 1}. ${c}`).join('\n') : '今天学习很顺利，没有遇到明显的困难！'}

## 📈 学习进度
- 完成任务：${summaryData.progress.tasksCompleted} 个
- 学习时长：约 ${summaryData.progress.timeSpent} 分钟
- 阅读资料：${summaryData.progress.materialsRead} 份

## 💡 明日建议
${summaryData.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---
*本总结由 AI 自动生成于 ${new Date().toLocaleString('zh-CN')}*
    `.trim()

    // 保存 AI 生成的日报
    await prisma.dailyReport.create({
      data: {
        userId: task.userId,
        reportDate: new Date(today),
        type: 'ai_generated',
        title: `${today} 学习总结`,
        contentMarkdown: summaryMarkdown,
        summaryJson: JSON.stringify(summaryData),
        mapId: task.mapId,
        achievements: JSON.stringify(summaryData.achievements),
        challenges: JSON.stringify(summaryData.challenges),
      },
    })

    console.log('[Daily Summary] Generated summary for', today)
  } catch (error) {
    console.error('[Daily Summary] Error:', error)
    throw error
  }
}
