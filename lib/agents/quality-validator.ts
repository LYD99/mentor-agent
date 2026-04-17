/**
 * 学习资料质量验证模块
 * 提供多维度的质量评估和改进建议
 * 
 * 双重验证机制：
 * 1. 代码评估（规则检查）- 快速验证基本质量
 * 2. LLM评估（语义理解）- 深度验证内容质量
 * 
 * 只有两者都通过才算合格
 */

import type { LessonContent } from './lesson-agent'
import { getEnv } from '@/lib/config/env-runtime'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

export interface QualityScore {
  overall: number // 0-100
  dimensions: {
    completeness: number
    clarity: number
    depth: number
    practicality: number
    engagement: number
  }
  issues: string[]
  suggestions: string[]
  passed: boolean
  // LLM 评估结果
  llmAssessment?: {
    score: number
    passed: boolean
    feedback: string
    strengths: string[]
    weaknesses: string[]
  }
}

/**
 * 评估学习资料的质量
 */
export function assessLessonQuality(content: LessonContent): QualityScore {
  const issues: string[] = []
  const suggestions: string[] = []
  const scores = {
    completeness: 0,
    clarity: 0,
    depth: 0,
    practicality: 0,
    engagement: 0,
  }

  // 1. 完整性评估 (Completeness)
  let completenessScore = 0
  
  if (content.introduction && content.introduction.length >= 100) {
    completenessScore += 20
  } else {
    issues.push('Introduction is too short or missing')
    suggestions.push('Expand introduction to at least 100 characters with compelling context')
  }
  
  if (content.keyPoints && content.keyPoints.length >= 3 && content.keyPoints.length <= 7) {
    completenessScore += 20
  } else {
    issues.push('Key points should be between 3-7 items')
    suggestions.push('Adjust key points to optimal range (3-7 items)')
  }
  
  if (content.detailedContent && content.detailedContent.length >= 200) {
    completenessScore += 20
  } else {
    issues.push('Detailed content is insufficient')
    suggestions.push('Expand detailed content with more examples and explanations')
  }
  
  if (content.resources && content.resources.length > 0) {
    completenessScore += 20
  } else {
    issues.push('No learning resources provided')
    suggestions.push('Add at least 3-5 high-quality learning resources')
  }
  
  if (content.summary && content.summary.length >= 50) {
    completenessScore += 20
  } else {
    issues.push('Summary is too brief or missing')
    suggestions.push('Provide a comprehensive summary of key takeaways')
  }
  
  scores.completeness = completenessScore

  // 2. 清晰度评估 (Clarity)
  let clarityScore = 0
  
  // 检查 key points 是否有详细解释
  const keyPointsWithExplanation = content.keyPoints.filter(
    kp => kp.explanation && kp.explanation.length > 20
  ).length
  clarityScore += (keyPointsWithExplanation / content.keyPoints.length) * 30
  
  // 检查 detailed content 是否使用了标题结构
  const hasHeadings = /#{2,3}\s+\w+/.test(content.detailedContent)
  if (hasHeadings) {
    clarityScore += 30
  } else {
    issues.push('Detailed content lacks clear structure (headings)')
    suggestions.push('Use markdown headings (##, ###) to organize content')
  }
  
  // 检查是否有代码示例或具体例子
  const hasCodeBlocks = /```[\s\S]*?```/.test(content.detailedContent)
  const hasExamples = /example|示例|例如/i.test(content.detailedContent)
  if (hasCodeBlocks || hasExamples) {
    clarityScore += 40
  } else {
    suggestions.push('Add concrete examples or code snippets for better clarity')
  }
  
  scores.clarity = Math.min(100, clarityScore)

  // 3. 深度评估 (Depth)
  let depthScore = 0
  
  // 内容长度作为深度指标之一
  const contentLength = content.detailedContent.length
  if (contentLength >= 1000) {
    depthScore += 30
  } else if (contentLength >= 500) {
    depthScore += 20
  } else {
    issues.push('Content lacks sufficient depth')
    suggestions.push('Provide more in-depth explanations and multiple perspectives')
  }
  
  // 检查是否有常见误区
  if (content.commonMisconceptions && content.commonMisconceptions.length > 0) {
    depthScore += 25
  } else {
    suggestions.push('Add common misconceptions section to deepen understanding')
  }
  
  // 检查是否有实际应用
  if (content.realWorldApplications && content.realWorldApplications.length > 0) {
    depthScore += 25
  } else {
    suggestions.push('Include real-world applications to show practical relevance')
  }
  
  // 检查是否有后续步骤
  if (content.nextSteps && content.nextSteps.length > 0) {
    depthScore += 20
  } else {
    suggestions.push('Add next steps to guide continued learning')
  }
  
  scores.depth = depthScore

  // 4. 实用性评估 (Practicality)
  let practicalityScore = 0
  
  // 检查练习题
  if (content.exercises && content.exercises.length >= 2) {
    practicalityScore += 30
    
    // 检查练习题多样性
    const exerciseTypes = new Set(content.exercises.map(ex => ex.type))
    if (exerciseTypes.size >= 2) {
      practicalityScore += 20
    } else {
      suggestions.push('Include diverse exercise types (multiple choice, coding, essay, etc.)')
    }
    
    // 检查是否有提示
    const exercisesWithHints = content.exercises.filter(ex => ex.hints && ex.hints.length > 0).length
    if (exercisesWithHints > 0) {
      practicalityScore += 20
    } else {
      suggestions.push('Add progressive hints to exercises for better scaffolding')
    }
  } else {
    issues.push('Insufficient practice exercises')
    suggestions.push('Add at least 2-5 practice exercises with detailed explanations')
  }
  
  // 检查资源质量
  if (content.resources.length >= 3) {
    practicalityScore += 30
    
    // 检查资源多样性
    const resourceTypes = new Set(content.resources.map(r => r.type))
    if (resourceTypes.size >= 3) {
      practicalityScore += 10
    }
  } else {
    suggestions.push('Provide at least 3-5 diverse learning resources')
  }
  
  scores.practicality = Math.min(100, practicalityScore)

  // 5. 参与度评估 (Engagement)
  let engagementScore = 0
  
  // 检查引言是否吸引人
  const introHasQuestion = /\?/.test(content.introduction)
  const introHasScenario = /(imagine|consider|think about|例如|想象|考虑)/i.test(content.introduction)
  if (introHasQuestion || introHasScenario) {
    engagementScore += 25
  } else {
    suggestions.push('Start with a compelling question or scenario to engage learners')
  }
  
  // 检查是否使用了类比或比喻
  const hasAnalogy = /(like|similar to|就像|类似于|比如说)/i.test(content.detailedContent)
  if (hasAnalogy) {
    engagementScore += 25
  } else {
    suggestions.push('Use analogies and metaphors to make concepts more relatable')
  }
  
  // 检查 key points 是否强调重要性
  const keyPointsWithImportance = content.keyPoints.filter(
    kp => kp.importance && kp.importance.length > 10
  ).length
  if (keyPointsWithImportance >= content.keyPoints.length * 0.5) {
    engagementScore += 25
  } else {
    suggestions.push('Explain why each key point matters to increase engagement')
  }
  
  // 检查是否有视觉元素描述
  const hasVisualElements = /(diagram|chart|图表|示意图|流程图)/i.test(content.detailedContent)
  if (hasVisualElements) {
    engagementScore += 25
  } else {
    suggestions.push('Describe diagrams or visual aids to enhance understanding')
  }
  
  scores.engagement = engagementScore

  // 计算总分
  const overall = Math.round(
    (scores.completeness * 0.25 +
     scores.clarity * 0.2 +
     scores.depth * 0.2 +
     scores.practicality * 0.2 +
     scores.engagement * 0.15)
  )

  // 质量阈值：70分及格
  const passed = overall >= 70 && scores.completeness >= 80

  return {
    overall,
    dimensions: scores,
    issues,
    suggestions,
    passed,
  }
}

/**
 * 生成质量报告（用于日志或调试）
 */
export function generateQualityReport(score: QualityScore): string {
  const { overall, dimensions, issues, suggestions, passed, llmAssessment } = score

  let report = `\n=== Lesson Quality Assessment (Dual Validation) ===\n`
  
  // 代码评估结果
  report += `\n📊 Code Assessment:\n`
  report += `  Overall Score: ${overall}/100 ${passed ? '✓' : '✗'}\n`
  report += `  Status: ${passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}\n\n`
  
  report += `  Dimension Scores:\n`
  report += `    - Completeness: ${dimensions.completeness}/100\n`
  report += `    - Clarity: ${dimensions.clarity}/100\n`
  report += `    - Depth: ${dimensions.depth}/100\n`
  report += `    - Practicality: ${dimensions.practicality}/100\n`
  report += `    - Engagement: ${dimensions.engagement}/100\n`
  
  // LLM 评估结果
  if (llmAssessment) {
    report += `\n🤖 LLM Assessment:\n`
    report += `  Overall Score: ${llmAssessment.score}/100 ${llmAssessment.passed ? '✓' : '✗'}\n`
    report += `  Status: ${llmAssessment.passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}\n`
    report += `  Feedback: ${llmAssessment.feedback}\n\n`
    
    if (llmAssessment.strengths.length > 0) {
      report += `  Strengths:\n`
      llmAssessment.strengths.forEach((strength, i) => {
        report += `    ${i + 1}. ${strength}\n`
      })
      report += `\n`
    }
    
    if (llmAssessment.weaknesses.length > 0) {
      report += `  Weaknesses:\n`
      llmAssessment.weaknesses.forEach((weakness, i) => {
        report += `    ${i + 1}. ${weakness}\n`
      })
      report += `\n`
    }
  } else {
    report += `\n🤖 LLM Assessment: Not available\n`
  }
  
  // 综合结果
  report += `\n🎯 Final Result:\n`
  if (llmAssessment) {
    const bothPassed = passed && llmAssessment.passed
    report += `  Both assessments passed: ${bothPassed ? '✓ YES' : '✗ NO'}\n`
    report += `  Code: ${passed ? '✓' : '✗'} | LLM: ${llmAssessment.passed ? '✓' : '✗'}\n`
  } else {
    report += `  Code assessment only: ${passed ? '✓ PASSED' : '✗ FAILED'}\n`
  }
  
  // 问题和建议
  if (issues.length > 0) {
    report += `\n⚠️  Issues Found:\n`
    issues.forEach((issue, i) => {
      report += `  ${i + 1}. ${issue}\n`
    })
  }
  
  if (suggestions.length > 0) {
    report += `\n💡 Improvement Suggestions:\n`
    suggestions.forEach((suggestion, i) => {
      report += `  ${i + 1}. ${suggestion}\n`
    })
  }
  
  report += `\n====================================================\n`
  
  return report
}

/**
 * 检查是否需要重新生成（质量不达标）
 */
export function shouldRegenerate(score: QualityScore): boolean {
  // 从环境变量读取最低质量分数，默认 70
  const minQualityScore = parseInt(getEnv('MIN_QUALITY_SCORE') || '70', 10)
  
  // 如果总分低于阈值或完整性低于 80，建议重新生成
  return score.overall < minQualityScore || score.dimensions.completeness < 80
}

/**
 * 检查是否启用质量验证
 */
export function isQualityValidationEnabled(): boolean {
  const enabled = getEnv('ENABLE_QUALITY_VALIDATION')
  // 默认启用，除非明确设置为 false
  return enabled !== 'false'
}

/**
 * LLM 质量评估 Schema
 */
const LLMQualityAssessmentSchema = z.object({
  score: z.number().min(0).max(100).describe('Overall quality score from 0-100'),
  feedback: z.string().describe('Overall feedback on the content quality'),
  strengths: z.array(z.string()).min(2).max(5).describe('List of strengths (2-5 items)'),
  weaknesses: z.array(z.string()).max(5).describe('List of weaknesses or areas for improvement (0-5 items)'),
  specificIssues: z.array(z.object({
    category: z.string().describe('Issue category (e.g., accuracy, clarity, depth, engagement, structure, examples, pacing, balance, etc.)'),
    issue: z.string(),
    suggestion: z.string(),
  })).optional().describe('Specific issues with improvement suggestions'),
})

/**
 * 使用 LLM 评估学习资料质量
 */
export async function assessLessonQualityWithLLM(
  content: LessonContent,
  taskTitle: string,
  abortSignal?: AbortSignal
): Promise<QualityScore['llmAssessment']> {
  const apiKey = getEnv('AI_API_KEY')
  const baseURL = getEnv('AI_BASE_URL')
  
  if (!apiKey?.trim()) {
    console.warn('[LLM Quality Assessment] No API key, skipping LLM assessment')
    return undefined
  }
  
  const openaiProvider = createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })
  
  // 使用快速模型进行质量评估
  const model = openaiProvider(getEnv('AI_MODEL') || 'gpt-4o-mini')
  
  // 构建评估 prompt
  const assessmentPrompt = `You are an expert educational content reviewer. Evaluate the quality of the following learning material.

**Task Title**: ${taskTitle}

**Learning Material Content**:

**Introduction**:
${content.introduction}

**Key Points** (${content.keyPoints.length} items):
${content.keyPoints.map((kp, i) => `${i + 1}. ${kp.point}\n   Explanation: ${kp.explanation}\n   ${kp.importance ? `Importance: ${kp.importance}` : ''}`).join('\n')}

**Detailed Content** (${content.detailedContent.length} characters):
${content.detailedContent.substring(0, 2000)}${content.detailedContent.length > 2000 ? '...(truncated)' : ''}

**Summary**:
${content.summary}

**Exercises**: ${content.exercises?.length || 0} exercises
${content.exercises ? content.exercises.slice(0, 2).map((ex, i) => `${i + 1}. ${ex.question} (${ex.type})`).join('\n') : 'None'}

**Resources**: ${content.resources.length} resources
${content.resources.slice(0, 3).map((r, i) => `${i + 1}. ${r.title} (${r.type})`).join('\n')}

**Common Misconceptions**: ${content.commonMisconceptions?.length || 0} items
**Real-world Applications**: ${content.realWorldApplications?.length || 0} items
**Next Steps**: ${content.nextSteps?.length || 0} items

---

**Evaluation Criteria**:
1. **Accuracy**: Is the content technically accurate and up-to-date?
2. **Clarity**: Is the content well-organized, easy to understand, and logically structured?
3. **Depth**: Does it provide sufficient depth without being overwhelming?
4. **Engagement**: Is the content engaging and motivating for learners?
5. **Practicality**: Does it include practical examples, exercises, and actionable insights?
6. **Completeness**: Are all essential components present and well-developed?

**Quality Standards**:
- Score 90-100: Exceptional quality, publication-ready
- Score 75-89: Good quality, minor improvements needed
- Score 60-74: Acceptable, significant improvements needed
- Score < 60: Poor quality, major revision required

**Pass Threshold**: 75/100

Provide a comprehensive quality assessment.`

  try {
    const { object } = await generateObject({
      model,
      schema: LLMQualityAssessmentSchema,
      prompt: assessmentPrompt,
      temperature: 0.3, // 低温度以获得更一致的评估
      abortSignal,
    })
    
    // 从环境变量读取 LLM 评估的最低分数，默认 75
    const llmMinScore = parseInt(getEnv('LLM_QUALITY_MIN_SCORE') || '75', 10)
    const passed = object.score >= llmMinScore
    
    console.log('[LLM Quality Assessment] Score:', object.score, 'Passed:', passed, `(threshold: ${llmMinScore})`)
    
    return {
      score: object.score,
      passed,
      feedback: object.feedback,
      strengths: object.strengths,
      weaknesses: object.weaknesses,
    }
  } catch (error) {
    console.error('[LLM Quality Assessment] Failed:', error)
    // LLM 评估失败时，返回 undefined，让代码评估决定
    return undefined
  }
}

/**
 * 检查是否启用 LLM 质量评估
 */
export function isLLMQualityAssessmentEnabled(): boolean {
  const enabled = getEnv('ENABLE_LLM_QUALITY_ASSESSMENT')
  // 默认启用，除非明确设置为 false
  return enabled !== 'false'
}

/**
 * 评估成长地图质量（代码规则）
 */
export function assessGrowthMapQuality(mapData: {
  title: string
  description: string
  stages: Array<{
    title: string
    description: string
    tasks: Array<{
      title: string
      description: string
      type: string
      durationDays: number
    }>
  }>
}): QualityScore {
  const issues: string[] = []
  const suggestions: string[] = []
  const scores = {
    completeness: 0,
    clarity: 0,
    depth: 0,
    practicality: 0,
    engagement: 0,
  }

  // 1. 完整性评估
  let completenessScore = 0
  
  if (mapData.title && mapData.title.length >= 5) {
    completenessScore += 20
  } else {
    issues.push('Map title is too short')
    suggestions.push('Provide a clear, descriptive title (at least 5 characters)')
  }
  
  if (mapData.description && mapData.description.length >= 50) {
    completenessScore += 20
  } else {
    issues.push('Map description is insufficient')
    suggestions.push('Expand description to at least 50 characters')
  }
  
  if (mapData.stages && mapData.stages.length >= 2) {
    completenessScore += 30
  } else {
    issues.push('Too few stages (minimum 2 recommended)')
    suggestions.push('Break down the learning path into at least 2-3 stages')
  }
  
  const totalTasks = mapData.stages.reduce((sum, s) => sum + s.tasks.length, 0)
  if (totalTasks >= 5) {
    completenessScore += 30
  } else {
    issues.push('Too few tasks overall')
    suggestions.push('Add more learning tasks (at least 5 total)')
  }
  
  scores.completeness = completenessScore

  // 2. 清晰度评估
  let clarityScore = 0
  
  const stagesWithDescription = mapData.stages.filter(s => s.description && s.description.length >= 30).length
  clarityScore += (stagesWithDescription / mapData.stages.length) * 40
  
  const tasksWithDescription = mapData.stages.flatMap(s => s.tasks).filter(t => t.description && t.description.length >= 20).length
  if (tasksWithDescription / totalTasks >= 0.8) {
    clarityScore += 40
  } else {
    suggestions.push('Add detailed descriptions to all tasks')
  }
  
  const hasVariedTaskTypes = new Set(mapData.stages.flatMap(s => s.tasks.map(t => t.type))).size >= 2
  if (hasVariedTaskTypes) {
    clarityScore += 20
  } else {
    suggestions.push('Include varied task types (learn, practice, test, reflect)')
  }
  
  scores.clarity = clarityScore

  // 3. 深度评估
  let depthScore = 0
  
  if (mapData.stages.length >= 3) {
    depthScore += 30
  }
  
  const avgTasksPerStage = totalTasks / mapData.stages.length
  if (avgTasksPerStage >= 3) {
    depthScore += 35
  } else {
    suggestions.push('Add more tasks per stage (recommended: 3-5 tasks per stage)')
  }
  
  const totalDuration = mapData.stages.flatMap(s => s.tasks).reduce((sum, t) => sum + t.durationDays, 0)
  if (totalDuration >= 14) {
    depthScore += 35
  } else if (totalDuration >= 7) {
    depthScore += 20
  } else {
    suggestions.push('Extend learning duration for better knowledge retention')
  }
  
  scores.depth = depthScore

  // 4. 实用性评估
  let practicalityScore = 0
  
  const practiceTasksCount = mapData.stages.flatMap(s => s.tasks).filter(t => t.type === 'practice').length
  if (practiceTasksCount >= 2) {
    practicalityScore += 50
  } else {
    suggestions.push('Add more practice tasks for hands-on learning')
  }
  
  const testTasksCount = mapData.stages.flatMap(s => s.tasks).filter(t => t.type === 'test').length
  if (testTasksCount >= 1) {
    practicalityScore += 50
  } else {
    suggestions.push('Add assessment tasks to validate learning outcomes')
  }
  
  scores.practicality = practicalityScore

  // 5. 参与度评估
  let engagementScore = 0
  
  const hasReflectTasks = mapData.stages.flatMap(s => s.tasks).some(t => t.type === 'reflect')
  if (hasReflectTasks) {
    engagementScore += 50
  } else {
    suggestions.push('Add reflection tasks for metacognitive development')
  }
  
  const hasProgressiveStructure = mapData.stages.every((stage, idx) => {
    if (idx === 0) return true
    const prevTasks = mapData.stages[idx - 1].tasks.length
    const currTasks = stage.tasks.length
    return Math.abs(prevTasks - currTasks) <= 3
  })
  if (hasProgressiveStructure) {
    engagementScore += 50
  } else {
    suggestions.push('Balance task distribution across stages')
  }
  
  scores.engagement = engagementScore

  const overall = Math.round(
    (scores.completeness * 0.3 +
     scores.clarity * 0.25 +
     scores.depth * 0.2 +
     scores.practicality * 0.15 +
     scores.engagement * 0.1)
  )

  const passed = overall >= 70 && scores.completeness >= 80

  return {
    overall,
    dimensions: scores,
    issues,
    suggestions,
    passed,
  }
}

/**
 * 使用 LLM 评估成长地图质量
 */
export async function assessGrowthMapQualityWithLLM(
  mapData: {
    title: string
    description: string
    stages: Array<{
      title: string
      description: string
      tasks: Array<{
        title: string
        description: string
        type: string
        durationDays: number
      }>
    }>
  },
  goal: string,
  abortSignal?: AbortSignal
): Promise<QualityScore['llmAssessment']> {
  const apiKey = getEnv('AI_API_KEY')
  const baseURL = getEnv('AI_BASE_URL')
  
  if (!apiKey?.trim()) {
    console.warn('[LLM Quality Assessment] No API key, skipping LLM assessment')
    return undefined
  }
  
  const openaiProvider = createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })
  
  const model = openaiProvider(getEnv('AI_MODEL') || 'gpt-4o-mini')
  
  const totalTasks = mapData.stages.reduce((sum, s) => sum + s.tasks.length, 0)
  const totalDuration = mapData.stages.flatMap(s => s.tasks).reduce((sum, t) => sum + t.durationDays, 0)
  
  const assessmentPrompt = `You are an expert learning path designer. Evaluate the quality of the following growth map.

**Learning Goal**: ${goal}

**Growth Map**:
- **Title**: ${mapData.title}
- **Description**: ${mapData.description}
- **Total Stages**: ${mapData.stages.length}
- **Total Tasks**: ${totalTasks}
- **Total Duration**: ${totalDuration} days

**Stages**:
${mapData.stages.map((stage, i) => `
${i + 1}. **${stage.title}**
   Description: ${stage.description}
   Tasks: ${stage.tasks.length}
   ${stage.tasks.map((task, j) => `   ${j + 1}. ${task.title} (${task.type}, ${task.durationDays}d)`).join('\n   ')}
`).join('\n')}

---

**Evaluation Criteria**:
1. **Alignment**: Does the map align well with the learning goal?
2. **Structure**: Is the learning path logically structured and progressive?
3. **Completeness**: Are all essential topics and skills covered?
4. **Balance**: Is there a good balance between theory and practice?
5. **Pacing**: Is the duration and task distribution appropriate?
6. **Clarity**: Are titles and descriptions clear and actionable?

**Quality Standards**:
- Score 90-100: Exceptional learning path design
- Score 75-89: Good quality, minor improvements needed
- Score 60-74: Acceptable, significant improvements needed
- Score < 60: Poor quality, major revision required

**Pass Threshold**: 75/100

Provide a comprehensive quality assessment.`

  try {
    const { object } = await generateObject({
      model,
      schema: LLMQualityAssessmentSchema,
      prompt: assessmentPrompt,
      temperature: 0.3,
      abortSignal,
    })
    
    const llmMinScore = parseInt(getEnv('LLM_QUALITY_MIN_SCORE') || '75', 10)
    const passed = object.score >= llmMinScore
    
    console.log('[LLM Quality Assessment - Growth Map] Score:', object.score, 'Passed:', passed)
    
    return {
      score: object.score,
      passed,
      feedback: object.feedback,
      strengths: object.strengths,
      weaknesses: object.weaknesses,
    }
  } catch (error) {
    console.error('[LLM Quality Assessment - Growth Map] Failed:', error)
    return undefined
  }
}

/**
 * 综合质量评估 - 成长地图（代码 + LLM）
 */
export async function assessGrowthMapQualityComprehensive(
  mapData: {
    title: string
    description: string
    stages: Array<{
      title: string
      description: string
      tasks: Array<{
        title: string
        description: string
        type: string
        durationDays: number
      }>
    }>
  },
  goal: string,
  abortSignal?: AbortSignal
): Promise<QualityScore> {
  const codeAssessment = assessGrowthMapQuality(mapData)
  
  console.log('[Quality Assessment - Growth Map] Code assessment:', {
    overall: codeAssessment.overall,
    passed: codeAssessment.passed,
  })
  
  const llmEnabled = isLLMQualityAssessmentEnabled()
  
  if (!llmEnabled) {
    console.log('[Quality Assessment - Growth Map] LLM assessment disabled')
    return codeAssessment
  }
  
  if (!codeAssessment.passed) {
    console.log('[Quality Assessment - Growth Map] Code assessment failed, skipping LLM')
    return codeAssessment
  }
  
  console.log('[Quality Assessment - Growth Map] Running LLM assessment...')
  const llmAssessment = await assessGrowthMapQualityWithLLM(mapData, goal, abortSignal)
  
  const finalScore: QualityScore = {
    ...codeAssessment,
    llmAssessment,
  }
  
  if (llmAssessment) {
    const bothPassed = codeAssessment.passed && llmAssessment.passed
    finalScore.passed = bothPassed
    
    if (!llmAssessment.passed) {
      finalScore.issues.push(`LLM assessment failed (score: ${llmAssessment.score}/100)`)
      finalScore.suggestions.push(...llmAssessment.weaknesses.map(w => `LLM feedback: ${w}`))
    }
    
    console.log('[Quality Assessment - Growth Map] Final:', {
      codeScore: codeAssessment.overall,
      llmScore: llmAssessment.score,
      finalPassed: bothPassed,
    })
  }
  
  return finalScore
}

/**
 * 综合质量评估（代码 + LLM）
 * 只有两者都通过才算合格
 */
export async function assessLessonQualityComprehensive(
  content: LessonContent,
  taskTitle: string,
  abortSignal?: AbortSignal
): Promise<QualityScore> {
  // 1. 先进行代码评估（快速）
  const codeAssessment = assessLessonQuality(content)
  
  console.log('[Quality Assessment] Code assessment:', {
    overall: codeAssessment.overall,
    passed: codeAssessment.passed,
  })
  
  // 2. 检查是否启用 LLM 评估
  const llmEnabled = isLLMQualityAssessmentEnabled()
  
  if (!llmEnabled) {
    console.log('[Quality Assessment] LLM assessment disabled, using code assessment only')
    return codeAssessment
  }
  
  // 3. 如果代码评估都没通过，直接返回（节省 LLM 调用）
  if (!codeAssessment.passed) {
    console.log('[Quality Assessment] Code assessment failed, skipping LLM assessment')
    return codeAssessment
  }
  
  // 4. 进行 LLM 评估
  console.log('[Quality Assessment] Code assessment passed, running LLM assessment...')
  const llmAssessment = await assessLessonQualityWithLLM(content, taskTitle, abortSignal)
  
  // 5. 合并结果
  const finalScore: QualityScore = {
    ...codeAssessment,
    llmAssessment,
  }
  
  // 6. 双重验证：两者都通过才算通过
  if (llmAssessment) {
    const bothPassed = codeAssessment.passed && llmAssessment.passed
    finalScore.passed = bothPassed
    
    // 如果 LLM 评估未通过，添加到 issues
    if (!llmAssessment.passed) {
      finalScore.issues.push(`LLM assessment failed (score: ${llmAssessment.score}/100)`)
      finalScore.suggestions.push(...llmAssessment.weaknesses.map(w => `LLM feedback: ${w}`))
    }
    
    console.log('[Quality Assessment] Final result:', {
      codeScore: codeAssessment.overall,
      codePassed: codeAssessment.passed,
      llmScore: llmAssessment.score,
      llmPassed: llmAssessment.passed,
      finalPassed: bothPassed,
    })
  } else {
    // LLM 评估失败或跳过，使用代码评估结果
    console.log('[Quality Assessment] LLM assessment unavailable, using code assessment only')
  }
  
  return finalScore
}

/**
 * 评估学习计划质量（代码规则）
 */
export function assessScheduleQuality(scheduleData: {
  dailySchedule: Array<{
    date: string
    tasks: Array<{
      taskTitle: string
      learningObjectives?: string[]
      difficulty?: string
      suggestedDuration?: string
      prerequisites?: string[]
      focusAreas?: string[]
    }>
  }>
}): QualityScore {
  const issues: string[] = []
  const suggestions: string[] = []
  const scores = {
    completeness: 0,
    clarity: 0,
    depth: 0,
    practicality: 0,
    engagement: 0,
  }

  const totalDays = scheduleData.dailySchedule.length
  const totalTasks = scheduleData.dailySchedule.reduce((sum, d) => sum + d.tasks.length, 0)

  // 1. 完整性评估
  let completenessScore = 0
  
  if (totalDays >= 7) {
    completenessScore += 30
  } else {
    issues.push('Schedule duration is too short')
    suggestions.push('Create a schedule with at least 7 days')
  }
  
  if (totalTasks >= 5) {
    completenessScore += 30
  } else {
    issues.push('Too few tasks in schedule')
    suggestions.push('Add more learning tasks')
  }
  
  const daysWithTasks = scheduleData.dailySchedule.filter(d => d.tasks.length > 0).length
  if (daysWithTasks / totalDays >= 0.8) {
    completenessScore += 40
  } else {
    suggestions.push('Ensure most days have learning tasks')
  }
  
  scores.completeness = completenessScore

  // 2. 清晰度评估
  let clarityScore = 0
  
  const tasksWithObjectives = scheduleData.dailySchedule.flatMap(d => d.tasks).filter(t => 
    t.learningObjectives && t.learningObjectives.length >= 2
  ).length
  
  if (tasksWithObjectives / totalTasks >= 0.8) {
    clarityScore += 40
  } else {
    suggestions.push('Add clear learning objectives to all tasks (2-4 items)')
  }
  
  const tasksWithDuration = scheduleData.dailySchedule.flatMap(d => d.tasks).filter(t => t.suggestedDuration).length
  if (tasksWithDuration / totalTasks >= 0.8) {
    clarityScore += 30
  } else {
    suggestions.push('Specify suggested duration for all tasks')
  }
  
  const tasksWithFocusAreas = scheduleData.dailySchedule.flatMap(d => d.tasks).filter(t => 
    t.focusAreas && t.focusAreas.length >= 2
  ).length
  
  if (tasksWithFocusAreas / totalTasks >= 0.5) {
    clarityScore += 30
  } else {
    suggestions.push('Add focus areas to help learners prioritize')
  }
  
  scores.clarity = clarityScore

  // 3. 深度评估
  let depthScore = 0
  
  const tasksWithPrerequisites = scheduleData.dailySchedule.flatMap(d => d.tasks).filter(t => 
    t.prerequisites && t.prerequisites.length > 0
  ).length
  
  if (tasksWithPrerequisites >= 2) {
    depthScore += 50
  } else {
    suggestions.push('Add prerequisites to tasks to show learning progression')
  }
  
  const hasDifficultyProgression = scheduleData.dailySchedule.some((d, i) => {
    if (i === 0) return true
    const prevDifficulty = scheduleData.dailySchedule[i - 1].tasks[0]?.difficulty
    const currDifficulty = d.tasks[0]?.difficulty
    return prevDifficulty && currDifficulty
  })
  
  if (hasDifficultyProgression) {
    depthScore += 50
  } else {
    suggestions.push('Include difficulty levels to show progression')
  }
  
  scores.depth = depthScore

  // 4. 实用性评估
  let practicalityScore = 0
  
  const avgTasksPerDay = totalTasks / totalDays
  if (avgTasksPerDay >= 1 && avgTasksPerDay <= 3) {
    practicalityScore += 50
  } else if (avgTasksPerDay > 3) {
    issues.push('Too many tasks per day (may overwhelm learners)')
    suggestions.push('Reduce tasks per day to 1-3 for better focus')
  } else {
    suggestions.push('Ensure consistent daily learning activities')
  }
  
  const hasWeekendBreaks = scheduleData.dailySchedule.some(d => {
    const dayOfWeek = new Date(d.date).getDay()
    return (dayOfWeek === 0 || dayOfWeek === 6) && d.tasks.length === 0
  })
  
  if (hasWeekendBreaks || totalDays <= 14) {
    practicalityScore += 50
  } else {
    suggestions.push('Consider adding rest days or lighter tasks on weekends')
  }
  
  scores.practicality = practicalityScore

  // 5. 参与度评估
  let engagementScore = 0
  
  const hasVariedDifficulty = new Set(
    scheduleData.dailySchedule.flatMap(d => d.tasks).map(t => t.difficulty).filter(Boolean)
  ).size >= 2
  
  if (hasVariedDifficulty) {
    engagementScore += 50
  } else {
    suggestions.push('Vary difficulty levels to maintain engagement')
  }
  
  const hasRichObjectives = scheduleData.dailySchedule.flatMap(d => d.tasks).filter(t => 
    t.learningObjectives && t.learningObjectives.length >= 3
  ).length
  
  if (hasRichObjectives >= totalTasks * 0.5) {
    engagementScore += 50
  } else {
    suggestions.push('Provide detailed learning objectives (3-4 per task)')
  }
  
  scores.engagement = engagementScore

  const overall = Math.round(
    (scores.completeness * 0.3 +
     scores.clarity * 0.25 +
     scores.depth * 0.2 +
     scores.practicality * 0.15 +
     scores.engagement * 0.1)
  )

  const passed = overall >= 70 && scores.completeness >= 80

  return {
    overall,
    dimensions: scores,
    issues,
    suggestions,
    passed,
  }
}

/**
 * 使用 LLM 评估学习计划质量
 */
export async function assessScheduleQualityWithLLM(
  scheduleData: {
    dailySchedule: Array<{
      date: string
      tasks: Array<{
        taskTitle: string
        learningObjectives?: string[]
        difficulty?: string
        suggestedDuration?: string
      }>
    }>
  },
  mapContext: string,
  abortSignal?: AbortSignal
): Promise<QualityScore['llmAssessment']> {
  const apiKey = getEnv('AI_API_KEY')
  const baseURL = getEnv('AI_BASE_URL')
  
  if (!apiKey?.trim()) {
    console.warn('[LLM Quality Assessment] No API key, skipping LLM assessment')
    return undefined
  }
  
  const openaiProvider = createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })
  
  const model = openaiProvider(getEnv('AI_MODEL') || 'gpt-4o-mini')
  
  const totalDays = scheduleData.dailySchedule.length
  const totalTasks = scheduleData.dailySchedule.reduce((sum, d) => sum + d.tasks.length, 0)
  
  const assessmentPrompt = `You are an expert learning schedule designer. Evaluate the quality of the following daily learning schedule.

**Map Context**: ${mapContext.substring(0, 500)}...

**Schedule Overview**:
- **Total Days**: ${totalDays}
- **Total Tasks**: ${totalTasks}
- **Avg Tasks/Day**: ${(totalTasks / totalDays).toFixed(1)}

**Sample Days** (first 5):
${scheduleData.dailySchedule.slice(0, 5).map((day, i) => `
Day ${i + 1} (${day.date}):
${day.tasks.map((task, j) => `  ${j + 1}. ${task.taskTitle}
     Objectives: ${task.learningObjectives?.join(', ') || 'N/A'}
     Difficulty: ${task.difficulty || 'N/A'}
     Duration: ${task.suggestedDuration || 'N/A'}`).join('\n')}
`).join('\n')}

---

**Evaluation Criteria**:
1. **Pacing**: Is the learning pace appropriate and sustainable?
2. **Progression**: Do tasks build on each other logically?
3. **Clarity**: Are learning objectives clear and actionable?
4. **Balance**: Is there good balance between learning, practice, and review?
5. **Realism**: Are time estimates and daily workload realistic?
6. **Completeness**: Are all necessary metadata (objectives, duration, difficulty) provided?

**Quality Standards**:
- Score 90-100: Exceptional schedule design
- Score 75-89: Good quality, minor improvements needed
- Score 60-74: Acceptable, significant improvements needed
- Score < 60: Poor quality, major revision required

**Pass Threshold**: 75/100

Provide a comprehensive quality assessment.`

  try {
    const { object } = await generateObject({
      model,
      schema: LLMQualityAssessmentSchema,
      prompt: assessmentPrompt,
      temperature: 0.3,
      abortSignal,
    })
    
    const llmMinScore = parseInt(getEnv('LLM_QUALITY_MIN_SCORE') || '75', 10)
    const passed = object.score >= llmMinScore
    
    console.log('[LLM Quality Assessment - Schedule] Score:', object.score, 'Passed:', passed)
    
    return {
      score: object.score,
      passed,
      feedback: object.feedback,
      strengths: object.strengths,
      weaknesses: object.weaknesses,
    }
  } catch (error) {
    console.error('[LLM Quality Assessment - Schedule] Failed:', error)
    return undefined
  }
}

/**
 * 综合质量评估 - 学习计划（代码 + LLM）
 */
export async function assessScheduleQualityComprehensive(
  scheduleData: {
    dailySchedule: Array<{
      date: string
      tasks: Array<{
        taskTitle: string
        learningObjectives?: string[]
        difficulty?: string
        suggestedDuration?: string
        prerequisites?: string[]
        focusAreas?: string[]
      }>
    }>
  },
  mapContext: string,
  abortSignal?: AbortSignal
): Promise<QualityScore> {
  const codeAssessment = assessScheduleQuality(scheduleData)
  
  console.log('[Quality Assessment - Schedule] Code assessment:', {
    overall: codeAssessment.overall,
    passed: codeAssessment.passed,
  })
  
  const llmEnabled = isLLMQualityAssessmentEnabled()
  
  if (!llmEnabled) {
    console.log('[Quality Assessment - Schedule] LLM assessment disabled')
    return codeAssessment
  }
  
  if (!codeAssessment.passed) {
    console.log('[Quality Assessment - Schedule] Code assessment failed, skipping LLM')
    return codeAssessment
  }
  
  console.log('[Quality Assessment - Schedule] Running LLM assessment...')
  const llmAssessment = await assessScheduleQualityWithLLM(scheduleData, mapContext, abortSignal)
  
  const finalScore: QualityScore = {
    ...codeAssessment,
    llmAssessment,
  }
  
  if (llmAssessment) {
    const bothPassed = codeAssessment.passed && llmAssessment.passed
    finalScore.passed = bothPassed
    
    if (!llmAssessment.passed) {
      finalScore.issues.push(`LLM assessment failed (score: ${llmAssessment.score}/100)`)
      finalScore.suggestions.push(...llmAssessment.weaknesses.map(w => `LLM feedback: ${w}`))
    }
    
    console.log('[Quality Assessment - Schedule] Final:', {
      codeScore: codeAssessment.overall,
      llmScore: llmAssessment.score,
      finalPassed: bothPassed,
    })
  }
  
  return finalScore
}
