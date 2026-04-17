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
  description: `生成详细的学习资料和练习题（使用多步骤生成策略）。

⚡ 生成过程：
本工具采用多步骤生成策略，将复杂的学习资料拆分为 4-5 个步骤：
1. 📝 生成大纲和关键点
2. 📚 生成详细内容（2-3个章节）
3. 💡 生成常见误区和实际应用
4. 📝 生成练习题
5. 📚 生成学习资源和后续步骤

每个步骤完成后会在控制台输出进度，最终结果会包含完整的进度摘要。

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
- focusAreas: 重点关注领域（可选，影响详细内容章节数量）
- knownMaterials: 已知的学习资料或参考内容（可选，如果已经通过 search_web 查询过，传入这里避免重复查询）

输出：
- 包含简介、关键点、详细内容、练习题、学习资源的完整学习资料
- 顶部会显示生成进度摘要`,

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

  execute: async (params, context?: { 
    userId?: string; 
    mapId?: string; 
    scheduleDate?: string;
    taskIds?: string[];
    dailyPlanIds?: string[];
    abortSignal?: AbortSignal;
    toolCallId?: string;
  }) => {
    try {
      const userId = context?.userId
      const mapId = context?.mapId
      const scheduleDate = context?.scheduleDate
      const taskIds = context?.taskIds || []
      const dailyPlanIds = context?.dailyPlanIds || []
      const abortSignal = context?.abortSignal
      const toolCallId = context?.toolCallId
      
      console.log(`[Generate Lesson Tool] Generating lesson: ${params.taskTitle}`, {
        hasKnownMaterials: !!params.knownMaterials,
        knownMaterialsLength: params.knownMaterials?.length,
        userId,
        mapId,
        scheduleDate,
        taskIdsCount: taskIds.length,
        dailyPlanIdsCount: dailyPlanIds.length,
        toolCallId,
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

      // knownMaterials 处理：不附加到描述中，直接传递给生成器
      // 这样可以避免 prompt 过长，同时保留完整的参考信息
      if (params.knownMaterials) {
        console.log(`[Generate Lesson Tool] Using knownMaterials: ${params.knownMaterials.length} chars (passed to generator)`)
      }

      // 调用 Lesson Agent 生成学习资料
      // 如果提供了 knownMaterials，则不进行在线研究（避免重复）
      // v2.5: goalTitle 参数已移除
      
      // 创建进度回调函数
      // 进度信息通过 SSE 推送到前端，同时在控制台显示
      const onProgress = (step: number, total: number, message: string) => {
        const progressMsg = `📊 [${step}/${total}] ${message}`;
        console.log(`[Generate Lesson Tool] Progress: ${progressMsg}`);
        
        // 如果有 toolCallId，通过 SSE 推送进度
        if (toolCallId) {
          const { progressBroadcaster } = require('@/lib/storage/progress-broadcaster')
          progressBroadcaster.pushProgress(toolCallId, {
            type: 'lesson_progress',
            currentStep: step,
            totalSteps: total,
            message,
          })
        }
      };
      
      const lessonContent = await generateLesson({
        taskTitle: params.taskTitle,
        taskDescription: params.taskDescription || '',
        taskType: 'learn', // 默认类型
        stageTitle: '自定义学习', // 占位符
        metadata,
        includeExercises: true, // 默认生成练习题
        includeResearch: !params.knownMaterials, // 如果有已知资料，就不再查询
        userId, // 传递 userId 以加载 RAG 配置
        abortSignal, // 传递 abortSignal 以支持中断
        onProgress, // 传递进度回调
        knownMaterials: params.knownMaterials, // 完整的参考资料
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
      
      // 格式化关键要点（现在是对象数组）
      const keyPointsText = lessonContent.keyPoints.map((kp, i) => {
        let text = `${i + 1}. **${kp.point}**\n   ${kp.explanation}`
        if (kp.importance) {
          text += `\n   > 💡 **重要性**: ${kp.importance}`
        }
        return text
      }).join('\n\n')
      sections.push(`## 🎯 关键要点\n\n${keyPointsText}`)
      
      sections.push(`## 📖 详细内容\n${lessonContent.detailedContent}`)

      // 常见误区（现在是对象数组）
      if (lessonContent.commonMisconceptions && lessonContent.commonMisconceptions.length > 0) {
        const misconceptionsText = lessonContent.commonMisconceptions.map((m, i) => 
          `${i + 1}. **误区**: ${m.misconception}\n   **纠正**: ${m.correction}`
        ).join('\n\n')
        sections.push(`## ⚠️ 常见误区\n\n${misconceptionsText}`)
      }

      // 实际应用
      if (lessonContent.realWorldApplications && lessonContent.realWorldApplications.length > 0) {
        const applicationsText = lessonContent.realWorldApplications.map((app, i) => 
          `${i + 1}. ${app}`
        ).join('\n')
        sections.push(`## 🌍 实际应用\n\n${applicationsText}`)
      }

      // 练习题（现在有更多字段）
      if (lessonContent.exercises && lessonContent.exercises.length > 0) {
        const exerciseParts: string[] = ['## 💪 练习题\n']
        
        lessonContent.exercises.forEach((ex, i) => {
          const exerciseLines: string[] = []
          exerciseLines.push(`### 练习 ${i + 1}\n`)
          
          // 添加难度标签
          if (ex.difficulty) {
            const difficultyEmoji = ex.difficulty === 'easy' ? '🟢' : ex.difficulty === 'medium' ? '🟡' : '🔴'
            exerciseLines.push(`${difficultyEmoji} **难度**: ${ex.difficulty}\n`)
          }
          
          exerciseLines.push(`**题目**: ${ex.question}\n`)
          
          if (ex.options && ex.options.length > 0) {
            exerciseLines.push('**选项**:')
            ex.options.forEach((opt, j) => {
              exerciseLines.push(`${String.fromCharCode(65 + j)}. ${opt}`)
            })
            exerciseLines.push('')
          }

          // 添加提示
          if (ex.hints && ex.hints.length > 0) {
            exerciseLines.push('**提示**:')
            ex.hints.forEach((hint, j) => {
              exerciseLines.push(`💡 ${j + 1}. ${hint}`)
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

      // 学习资源（现在是对象数组）
      if (lessonContent.resources.length > 0) {
        const resourceLines = ['## 📚 拓展资源\n']
        lessonContent.resources.forEach((r, i) => {
          const typeEmoji = {
            documentation: '📖',
            tutorial: '📝',
            video: '🎥',
            article: '📰',
            book: '📚',
            course: '🎓',
            tool: '🔧'
          }[r.type] || '📌'
          
          let resourceText = `${i + 1}. ${typeEmoji} **${r.title}**`
          if (r.difficulty) {
            const diffEmoji = r.difficulty === 'beginner' ? '🟢' : r.difficulty === 'intermediate' ? '🟡' : '🔴'
            resourceText += ` ${diffEmoji}`
          }
          resourceText += `\n   ${r.description}`
          if (r.url) {
            resourceText += `\n   🔗 [访问链接](${r.url})`
          }
          resourceLines.push(resourceText)
          resourceLines.push('')
        })
        sections.push(resourceLines.join('\n'))
      }

      // 总结
      if (lessonContent.summary) {
        sections.push(`## 📝 总结\n\n${lessonContent.summary}`)
      }

      // 下一步
      if (lessonContent.nextSteps && lessonContent.nextSteps.length > 0) {
        const nextStepsText = lessonContent.nextSteps.map((step, i) => 
          `${i + 1}. ${step}`
        ).join('\n')
        sections.push(`## 🚀 下一步学习\n\n${nextStepsText}`)
      }

      sections.push(`---\n*生成时间: ${new Date().toLocaleString('zh-CN')}*`)
      
      // 不在最终结果中包含进度信息，进度只在生成过程中的控制台显示
      const lessonMarkdown = sections.join('\n\n');

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

          // 智能匹配 taskId 和 dailyPlanId
          // 如果有多个任务，通过标题匹配找到正确的任务
          let taskId: string | null = null
          let dailyPlanId: string | null = null
          
          if (taskIds.length > 0 && dailyPlanIds.length > 0 && mapId && scheduleDate) {
            // 查询所有相关的任务和计划
            const tasks = await prisma.learningTask.findMany({
              where: { id: { in: taskIds } },
              select: { id: true, title: true },
            })
            
            const plans = await prisma.dailyPlan.findMany({
              where: { 
                id: { in: dailyPlanIds },
                mapId: mapId,
                planDate: new Date(scheduleDate),
              },
              select: { id: true, taskId: true },
            })
            
            // 尝试通过标题匹配找到对应的任务
            const matchedTask = tasks.find(t => 
              params.taskTitle.includes(t.title) || t.title.includes(params.taskTitle)
            )
            
            if (matchedTask) {
              taskId = matchedTask.id
              // 找到对应的 dailyPlan
              const matchedPlan = plans.find(p => p.taskId === matchedTask.id)
              if (matchedPlan) {
                dailyPlanId = matchedPlan.id
              }
            } else {
              // 如果没有匹配到，使用第一个
              taskId = taskIds[0]
              dailyPlanId = dailyPlanIds[0]
            }
          } else if (taskIds.length > 0) {
            taskId = taskIds[0]
          }
          
          if (dailyPlanIds.length > 0 && !dailyPlanId) {
            dailyPlanId = dailyPlanIds[0]
          }
          
          const savedLesson = await prisma.learningMaterial.create({
            data: {
              userId,
              type: 'daily_lesson',
              title: params.taskTitle,
              contentMarkdown: lessonMarkdown,
              contentJson,
              source: 'ai_generated',
              mapId: mapId || null,
              taskId: taskId,
              dailyPlanId: dailyPlanId,
              tags: JSON.stringify(tags),
              status: 'active', // 修复：使用 'active' 而不是 'learning'
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
