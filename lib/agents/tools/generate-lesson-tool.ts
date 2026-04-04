import { tool } from 'ai'
import { z } from 'zod'
import { generateLesson } from '../lesson-agent'
import { prisma } from '@/lib/db'

/**
 * Generate Lesson Tool
 * 
 * 为 Advisor Agent 提供生成学习资料的能力
 */
export const generateLessonTool = tool({
  description: `生成详细的学习资料和练习题。

使用场景：
- 用户请求为某个学习任务生成详细的学习资料
- 用户想要深入学习某个主题
- 用户需要练习题和学习资源

重要提示：
- 如果你认为需要最新的在线资料来丰富内容，可以先使用 search_web 工具查询相关资料
- 如果已经有足够的上下文信息（如用户提供的资料、之前查询的内容），可以直接生成学习资料
- 使用 knownMaterials 参数传递已知的学习资料，避免重复查询

输入参数：
- taskTitle: 学习任务的标题（必需）
- learningObjectives: 学习目标列表（可选，但强烈建议提供）
- difficulty: 难度级别（可选：beginner/intermediate/advanced）
- suggestedDuration: 建议学习时长（分钟，可选）
- prerequisites: 前置知识（可选）
- focusAreas: 重点关注领域（可选）
- knownMaterials: 已知的学习资料或参考内容（可选，如果已经通过 search_web 查询过，传入这里避免重复查询）

输出：
- 包含简介、关键点、详细内容、练习题、学习资源的完整学习资料`,

  parameters: z.object({
    taskTitle: z.string().describe('学习任务的标题，例如："深度学习基础"'),
    taskDescription: z.string().optional().describe('任务的详细描述（可选）'),
    learningObjectives: z.array(z.string()).optional().describe('学习目标列表，例如：["理解神经网络的基本原理", "掌握反向传播算法"]'),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().describe('难度级别：beginner（初级）、intermediate（中级）、advanced（高级）'),
    suggestedDuration: z.union([z.number(), z.string()]).optional().describe('建议学习时长（分钟数或描述，如 "1-2 hours"）'),
    prerequisites: z.array(z.string()).optional().describe('前置知识要求，例如：["线性代数基础", "Python 编程"]'),
    focusAreas: z.array(z.string()).optional().describe('重点关注的领域，例如：["理论理解", "实践应用"]'),
    knownMaterials: z.string().optional().describe('已知的学习资料或参考内容（可选）。如果你已经通过 search_web 查询了相关资料，请将查询结果传入这里，避免 Lesson Agent 内部重复查询。'),
  }),

  execute: async (params, context?: { userId?: string; mapId?: string; scheduleDate?: string }) => {
    try {
      const userId = context?.userId
      const mapId = context?.mapId
      const scheduleDate = context?.scheduleDate
      
      console.log(`[Generate Lesson Tool] Generating lesson: ${params.taskTitle}`, {
        hasKnownMaterials: !!params.knownMaterials,
        knownMaterialsLength: params.knownMaterials?.length,
        userId,
        mapId,
        scheduleDate,
      })
      
      // 构建 metadata
      const metadata = {
        learningObjectives: params.learningObjectives || [],
        difficulty: params.difficulty,
        suggestedDuration: typeof params.suggestedDuration === 'number' 
          ? params.suggestedDuration 
          : undefined,
        prerequisites: params.prerequisites || [],
        focusAreas: params.focusAreas || [],
      }

      // 构建任务描述，如果有 knownMaterials，附加到描述中
      let enhancedDescription = params.taskDescription || ''
      if (params.knownMaterials) {
        enhancedDescription += `\n\n参考资料：\n${params.knownMaterials}`
      }

      // 调用 Lesson Agent 生成学习资料
      // 如果提供了 knownMaterials，则不进行在线研究（避免重复）
      // v2.5: goalTitle 参数已移除
      const lessonContent = await generateLesson({
        taskTitle: params.taskTitle,
        taskDescription: enhancedDescription,
        taskType: 'learn', // 默认类型
        stageTitle: '自定义学习', // 占位符
        metadata,
        includeResearch: !params.knownMaterials, // 如果有已知资料，就不再查询
        userId, // 传递 userId 以加载 RAG 配置
      })

      // 格式化为 Markdown
      const sections: string[] = []
      
      sections.push(`# ${params.taskTitle}`)
      
      // 添加元数据信息
      if (metadata.difficulty || metadata.suggestedDuration) {
        const metaInfo: string[] = []
        if (metadata.difficulty) {
          metaInfo.push(`📊 **难度**: ${metadata.difficulty}`)
        }
        if (metadata.suggestedDuration) {
          metaInfo.push(`⏱️ **建议时长**: ${metadata.suggestedDuration}${typeof metadata.suggestedDuration === 'number' ? '分钟' : ''}`)
        }
        sections.push(`> ${metaInfo.join(' | ')}`)
      }
      
      if (metadata.learningObjectives.length > 0) {
        sections.push(`> 🎯 **学习目标**: ${metadata.learningObjectives.join(' · ')}`)
      }
      
      if (metadata.prerequisites.length > 0) {
        sections.push(`> 📚 **前置知识**: ${metadata.prerequisites.join(' · ')}`)
      }
      
      // 主要内容
      sections.push(`## 📚 学习目标\n${lessonContent.introduction}`)
      sections.push(`## 🎯 关键要点\n${lessonContent.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`)
      sections.push(`## 📖 详细内容\n${lessonContent.detailedContent}`)

      // 练习题
      if (lessonContent.exercises && lessonContent.exercises.length > 0) {
        const exerciseParts: string[] = ['## 💪 练习题\n']
        
        lessonContent.exercises.forEach((ex, i) => {
          const exerciseLines: string[] = []
          exerciseLines.push(`### 练习 ${i + 1}\n`)
          exerciseLines.push(`**题目**: ${ex.question}\n`)
          
          if (ex.options && ex.options.length > 0) {
            exerciseLines.push('**选项**:')
            ex.options.forEach((opt, j) => {
              exerciseLines.push(`${String.fromCharCode(65 + j)}. ${opt}`)
            })
            exerciseLines.push('')
          }

          exerciseLines.push(`**答案**: ${ex.answer}\n`)
          exerciseLines.push(`**解析**: ${ex.explanation}\n`)
          exerciseLines.push('---\n')
          
          exerciseParts.push(exerciseLines.join('\n'))
        })
        
        sections.push(exerciseParts.join('\n'))
      }

      // 学习资源
      if (lessonContent.resources.length > 0) {
        const resourceLines = ['## 📚 拓展资源\n']
        lessonContent.resources.forEach((r, i) => {
          resourceLines.push(`${i + 1}. ${r}`)
        })
        sections.push(resourceLines.join('\n'))
      }

      sections.push(`---\n*生成时间: ${new Date().toLocaleString('zh-CN')}*`)
      
      const lessonMarkdown = sections.join('\n\n')

      // 保存到数据库（如果有 userId）
      let savedLessonId: string | undefined
      if (userId) {
        try {
          // 构建 contentJson，包含结构化数据
          const contentJson = JSON.stringify({
            introduction: lessonContent.introduction,
            keyPoints: lessonContent.keyPoints,
            exercises: lessonContent.exercises,
            resources: lessonContent.resources,
            metadata,
            scheduleDate, // 关联的日期
          })

          // 构建 tags
          const tags = []
          if (scheduleDate) tags.push(`date:${scheduleDate}`)
          if (metadata.difficulty) tags.push(`difficulty:${metadata.difficulty}`)
          if (mapId) tags.push(`map:${mapId}`)

          const savedLesson = await prisma.learningMaterial.create({
            data: {
              userId,
              type: 'daily_lesson',
              title: params.taskTitle,
              contentMarkdown: lessonMarkdown,
              contentJson,
              source: 'ai_generated',
              mapId: mapId || null,
              tags: JSON.stringify(tags),
              status: 'learning',
            },
          })

          savedLessonId = savedLesson.id
          console.log(`[Generate Lesson Tool] Saved to database: ${savedLessonId}`)
        } catch (dbError) {
          console.error('[Generate Lesson Tool] Failed to save to database:', dbError)
          // 不阻断返回，即使保存失败也返回生成的内容
        }
      }

      return {
        success: true,
        title: params.taskTitle,
        contentMarkdown: lessonMarkdown,
        lessonId: savedLessonId, // 返回保存的 ID
        summary: {
          introduction: lessonContent.introduction.slice(0, 200) + '...',
          keyPointsCount: lessonContent.keyPoints.length,
          contentLength: lessonContent.detailedContent.length,
          exercisesCount: lessonContent.exercises?.length || 0,
          resourcesCount: lessonContent.resources.length,
        },
        message: `已为「${params.taskTitle}」生成学习资料${savedLessonId ? '并保存' : ''}`,
      }
    } catch (error) {
      console.error('[Generate Lesson Tool] Error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: '生成学习资料失败，请重试',
      }
    }
  },
})
