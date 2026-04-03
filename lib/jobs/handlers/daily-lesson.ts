import { prisma } from '@/lib/db'
import { generateLesson, type LessonParams } from '@/lib/agents/lesson-agent'

/**
 * 每日学习提醒处理器
 * 生成当天的学习资料、练习题（含答案）
 * 优化：检查是否已生成今日资料，避免重复生成
 */
export async function generateDailyLesson(task: {
  id: string
  mapId: string
  userId: string
  contentJson: string | null
}) {
  try {
    const content = task.contentJson ? JSON.parse(task.contentJson) : {}
    const params = content.params || {}

    // v2.5: 从 DailyPlan 表查询今日计划
    const today = new Date().toISOString().split('T')[0]
    
    const todayPlan = await prisma.dailyPlan.findFirst({
      where: {
        mapId: task.mapId,
        planDate: new Date(today),
      },
    })
    
    if (!todayPlan) {
      console.log(`[Daily Lesson] No plan found for today (${today}) - Skipping`)
      return
    }
    
    // v2.5: 通过 dailyPlanId 去重（更精确）
    const existingMaterial = await prisma.learningMaterial.findFirst({
      where: {
        dailyPlanId: todayPlan.id,
      },
      select: { id: true, title: true },
    })
    
    if (existingMaterial) {
      console.log(
        `[Daily Lesson] Material already exists for plan ${todayPlan.id}:`,
        existingMaterial.title,
        '- Skipping generation'
      )
      return
    }
    
    console.log(`[Daily Lesson] No existing material for plan ${todayPlan.id}, proceeding...`)
    
    // v2.5: 从 DailyPlan 获取任务信息和元数据
    const targetTask = await prisma.learningTask.findUnique({
      where: { id: todayPlan.taskId },
      include: {
        stage: true,
      },
    })

    if (!targetTask) {
      console.log(`[Daily Lesson] Task not found for plan ${todayPlan.id}`)
      return
    }

    // v2.5: 从 DailyPlan.metadata 解析元数据
    let metadata: LessonParams['metadata'] | undefined
    
    if (todayPlan.metadata) {
      try {
        const parsedMetadata = JSON.parse(todayPlan.metadata)
        metadata = {
          learningObjectives: parsedMetadata.learningObjectives,
          difficulty: parsedMetadata.difficulty,
          suggestedDuration: parsedMetadata.suggestedDuration,
          prerequisites: parsedMetadata.prerequisites,
          focusAreas: parsedMetadata.focusAreas,
        }
        console.log('[Daily Lesson] Using metadata from DailyPlan:', metadata)
      } catch (error) {
        console.warn('[Daily Lesson] Failed to parse DailyPlan metadata:', error)
      }
    }

    // v2.5: 使用 Lesson Agent 生成学习资料（移除 goalTitle）
    const lessonData = await generateLesson({
      taskTitle: targetTask.title,
      taskDescription: targetTask.description || undefined,
      taskType: targetTask.type,
      stageTitle: targetTask.stage.title,
      metadata,
      includeExercises: params.includeExercises ?? true,
      includeResearch: true,
    })

    // 生成 Markdown 格式的学习资料
    const sections: string[] = []
    
    // 标题和元数据信息
    sections.push(`# ${targetTask.title}`)
    
    if (metadata) {
      const metaInfo: string[] = []
      if (metadata.difficulty) {
        metaInfo.push(`📊 **难度**: ${metadata.difficulty}`)
      }
      if (metadata.suggestedDuration) {
        metaInfo.push(`⏱️ **建议时长**: ${metadata.suggestedDuration}分钟`)
      }
      if (metaInfo.length > 0) {
        sections.push(`> ${metaInfo.join(' | ')}`)
      }
      
      if (metadata.learningObjectives && metadata.learningObjectives.length > 0) {
        sections.push(`> 🎯 **学习目标**: ${metadata.learningObjectives.join(' · ')}`)
      }
      
      if (metadata.prerequisites && metadata.prerequisites.length > 0) {
        sections.push(`> 📚 **前置知识**: ${metadata.prerequisites.join(' · ')}`)
      }
    }
    
    // 基础部分
    sections.push(`## 📚 学习目标\n${lessonData.introduction}`)
    sections.push(`## 🎯 关键要点\n${lessonData.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`)
    sections.push(`## 📖 详细内容\n${lessonData.detailedContent}`)

    // 添加练习题
    if (params.includeExercises && lessonData.exercises && lessonData.exercises.length > 0) {
      const exerciseParts: string[] = ['## 💪 练习题\n']
      
      lessonData.exercises.forEach((ex, i) => {
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

        if (params.includeAnswers) {
          exerciseLines.push(`**答案**: ${ex.answer}\n`)
          exerciseLines.push(`**解析**: ${ex.explanation}\n`)
        }

        exerciseLines.push('---\n')
        exerciseParts.push(exerciseLines.join('\n'))
      })
      
      sections.push(exerciseParts.join('\n'))
    }

    // 添加学习资源
    if (lessonData.resources.length > 0) {
      const resourceLines = ['## 📚 拓展资源\n']
      lessonData.resources.forEach((r, i) => {
        resourceLines.push(`${i + 1}. ${r}`)
      })
      sections.push(resourceLines.join('\n'))
    }

    sections.push(`---\n*生成时间: ${new Date().toLocaleString('zh-CN')}*`)
    
    const lessonMarkdown = sections.join('\n\n')

    // v2.5: 保存为学习资料（关联 dailyPlanId）
    const tags = ['daily', 'auto-generated', targetTask.type]
    if (metadata?.difficulty) {
      tags.push(metadata.difficulty)
    }
    
    await prisma.learningMaterial.create({
      data: {
        userId: task.userId,
        type: 'daily_lesson',
        title: `${today} - ${targetTask.title}`,
        contentMarkdown: lessonMarkdown,
        contentJson: JSON.stringify({
          ...lessonData,
          metadata: metadata || null,
          generatedAt: new Date().toISOString(),
        }),
        source: 'ai_generated',
        mapId: task.mapId,
        taskId: targetTask.id,
        dailyPlanId: todayPlan.id, // v2.5: 关联 dailyPlanId
        tags: JSON.stringify(tags),
      },
    })

    // 更新任务状态为进行中
    if (targetTask.status === 'pending') {
      await prisma.learningTask.update({
        where: { id: targetTask.id },
        data: { status: 'in_progress' },
      })
    }

    console.log(
      `[Daily Lesson] Generated lesson for task: ${targetTask.title}` +
      (metadata ? ` (${metadata.difficulty}, ${metadata.suggestedDuration}min)` : '')
    )
  } catch (error) {
    console.error('[Daily Lesson] Error:', error)
    throw error
  }
}
