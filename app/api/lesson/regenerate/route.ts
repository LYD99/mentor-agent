import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateLesson, type LessonParams } from '@/lib/agents/lesson-agent'
import { NextResponse } from 'next/server'

/**
 * 手动重新生成学习资料 API
 * POST /api/lesson/regenerate
 * 
 * 用途：
 * - 用户对自动生成的资料不满意时，可以手动重新生成
 * - 学习计划更新后，重新生成资料以匹配新的元数据
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { taskId, mapId, date } = body

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      )
    }

    // v2.5: 查询任务详情（LearningTask 直接属于 Stage）
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
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // 验证权限：检查任务是否属于用户的地图
    const map = task.stage.map
    if (map.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!map) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // v2.5: 获取学习计划元数据（从 DailyPlan 表）
    let metadata: LessonParams['metadata'] | undefined
    const targetDate = date || new Date().toISOString().split('T')[0]

    try {
      const dailyPlans = await prisma.dailyPlan.findMany({
        where: {
          mapId: map.id,
          taskId: taskId,
          planDate: new Date(targetDate),
        },
      })

      if (dailyPlans.length > 0) {
        const plan = dailyPlans[0]
        if (plan.metadata) {
          const parsedMetadata = JSON.parse(plan.metadata)
          metadata = {
            learningObjectives: parsedMetadata.learningObjectives,
            difficulty: parsedMetadata.difficulty,
            suggestedDuration: parsedMetadata.suggestedDuration,
            prerequisites: parsedMetadata.prerequisites,
            focusAreas: parsedMetadata.focusAreas,
          }
        }
      }
    } catch (error) {
      console.warn('[Regenerate Lesson] Failed to fetch daily plan:', error)
    }

    // v2.5: 生成新的学习资料（LearningTask 直接属于 Stage，goalTitle 参数已移除）
    const lessonData = await generateLesson({
      taskTitle: task.title,
      taskDescription: task.description || undefined,
      taskType: task.type,
      stageTitle: task.stage.title,
      metadata,
      includeExercises: true,
      includeResearch: true,
    })

    // 构建 Markdown 内容
    const sections: string[] = []
    sections.push(`# ${task.title}`)

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
    }

    sections.push(`## 📚 学习目标\n${lessonData.introduction}`)
    sections.push(
      `## 🎯 关键要点\n${lessonData.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    )
    sections.push(`## 📖 详细内容\n${lessonData.detailedContent}`)

    if (lessonData.exercises && lessonData.exercises.length > 0) {
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

        exerciseLines.push(`**答案**: ${ex.answer}\n`)
        exerciseLines.push(`**解析**: ${ex.explanation}\n`)
        exerciseLines.push('---\n')
        exerciseParts.push(exerciseLines.join('\n'))
      })
      sections.push(exerciseParts.join('\n'))
    }

    if (lessonData.resources.length > 0) {
      const resourceLines = ['## 📚 拓展资源\n']
      lessonData.resources.forEach((r, i) => {
        resourceLines.push(`${i + 1}. ${r}`)
      })
      sections.push(resourceLines.join('\n'))
    }

    sections.push(`---\n*重新生成时间: ${new Date().toLocaleString('zh-CN')}*`)
    const lessonMarkdown = sections.join('\n\n')

    // 保存为新的学习资料（标记为手动生成）
    const tags = ['manual-regenerate', task.type]
    if (metadata?.difficulty) {
      tags.push(metadata.difficulty)
    }

    const material = await prisma.learningMaterial.create({
      data: {
        userId: session.user.id,
        type: 'daily_lesson',
        title: `${targetDate} - ${task.title} (重新生成)`,
        contentMarkdown: lessonMarkdown,
        contentJson: JSON.stringify({
          ...lessonData,
          metadata: metadata || null,
          regeneratedAt: new Date().toISOString(),
        }),
        source: 'ai_generated',
        mapId: map.id,
        taskId: task.id,
        tags: JSON.stringify(tags),
      },
    })

    console.log(
      `[Regenerate Lesson] Successfully regenerated lesson for task: ${task.title}`
    )

    return NextResponse.json({
      success: true,
      material: {
        id: material.id,
        title: material.title,
        createdAt: material.createdAt,
      },
      message: '学习资料已重新生成',
    })
  } catch (error) {
    console.error('[Regenerate Lesson] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to regenerate lesson',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
