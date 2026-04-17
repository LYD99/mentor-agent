/**
 * Agent 提示词 - Plan, Schedule, Lesson Agents
 * 集中管理所有 Agent 相关的提示词
 */

export const AGENT_PROMPTS = {
  // Plan Agent - 生成成长地图
  PLAN_AGENT: {
    BASE: `Generate a structured growth/learning map for the following user.

User Goal:
{{userGoal}}

User Context:
{{contextPack}}
`,
    
    WITH_RESEARCH: `
Research Results (relevant resources and information):
{{researchSummary}}

Use these research findings to inform your learning path design.
`,

    REQUIREMENTS: `
Create a comprehensive, structured learning plan that:
1. Breaks down the goal into logical stages (2-6 stages)
2. Each stage has clear goals and measurable outcomes
3. Each goal has specific, actionable tasks
4. Tasks are categorized by type: learn, practice, test, reflect
5. Includes realistic time estimates (durationWeeks for stages, durationDays for tasks)
6. Progresses from beginner to advanced concepts
7. Balances theory (learn) with practice (practice, test, reflect)

Ensure the plan is:
- Practical and achievable
- Well-structured and easy to follow
- Comprehensive but not overwhelming
- Tailored to the user's context and goals
`,
  },

  // Schedule Agent - 生成学习计划
  SCHEDULE_AGENT: {
    BATCH_PROMPT: `You are a learning schedule planner. Generate a detailed daily learning schedule for the following stage.

Stage Information:
- Stage {{stageIndex}}/{{totalStages}}: {{stageTitle}}
- Description: {{stageDescription}}
- Duration: {{durationWeeks}} weeks
- Start Date: {{startDate}}

Goals and Tasks:
{{goalsAndTasks}}

Growth Map Context:
{{mapContext}}

Requirements:
1. Create daily schedules with learning metadata (NOT full content)
2. For each day, specify:
   - Learning objectives (2-4 key points to learn)
   - Difficulty level (beginner/intermediate/advanced)
   - Suggested duration (e.g., "1-2 hours", "30-60 minutes")
   - Prerequisites (if any)
   - Focus areas (2-3 main topics/skills)
3. Distribute tasks evenly across the {{durationWeeks}} weeks
4. Balance different task types (learn, practice, test, reflect)
5. Ensure logical progression from simple to complex
6. Consider realistic daily time commitments

IMPORTANT: Generate ONLY metadata, not full learning content. The actual lessons will be generated later when the user studies each day.
`,
  },

  // Lesson Agent - 生成学习资料
  LESSON_AGENT: {
    BASE: `You are a professional learning content creator with expertise in instructional design and pedagogy. Your goal is to create high-quality, engaging, and effective learning materials.

Task Information:
- Title: {{taskTitle}}
- Description: {{taskDescription}}
- Type: {{taskType}}
- Stage: {{stageTitle}}

CRITICAL OUTPUT FORMAT: Return a valid JSON object with this exact structure:
- introduction: string (2-3 paragraphs)
- keyPoints: array of {point, explanation, importance?}
- detailedContent: string (markdown with ## headings)
- commonMisconceptions: array of {misconception, correction} (optional)
- realWorldApplications: array of strings (optional)
- exercises: array of {question, type, answer, explanation, difficulty?, options?, hints?} (optional)
- resources: array of {title, type, description, url?, difficulty?} (required, at least 1)
- summary: string (required)
- nextSteps: array of strings (optional)
- estimatedStudyTime: number (optional)
- prerequisites: array of strings (optional)
`,

    WITH_METADATA: `
Learning Metadata (from schedule):
{{metadata}}
`,

    WITH_RESEARCH: `
Research Results (relevant resources found):
{{researchSummary}}

Use these research findings to:
- Validate and enrich your content with authoritative sources
- Include up-to-date information and best practices
- Reference specific examples from reputable sources
- Provide diverse perspectives on the topic
`,

    REQUIREMENTS_WITH_EXERCISES: `
Content Requirements:

1. Introduction (2-3 paragraphs): Hook learner, explain importance, set objectives
2. Key Points (3-7): Each with point, explanation, and importance
3. Detailed Content: In-depth explanation with 2-3 practical examples
   - Use markdown ## for sections
   - Keep code examples concise (10-20 lines max per example)
   - Focus on clarity, avoid repetition
4. Common Misconceptions (optional): 2-3 items with corrections
5. Real-World Applications (optional): 2-3 brief practical use cases
6. Exercises (2-4): Include question, type, answer, explanation, optional hints/difficulty
7. Resources (3-5): Each with title, type, description, optional url/difficulty
8. Summary: Concise 1-paragraph recap
9. Next Steps (optional): 2-3 follow-up topics

IMPORTANT: Keep content focused and concise. Avoid overly long explanations or repetitive patterns.
`,

    REQUIREMENTS_NO_EXERCISES: `
Content Requirements:

1. Introduction (2-3 paragraphs): Hook learner, explain importance, set objectives
2. Key Points (3-7): Each with point, explanation, and importance
3. Detailed Content: In-depth explanation with 2-3 practical examples
   - Use markdown ## for sections
   - Keep code examples concise (10-20 lines max per example)
   - Focus on clarity, avoid repetition
4. Common Misconceptions (optional): 2-3 items with corrections
5. Real-World Applications (optional): 2-3 brief practical use cases
6. Resources (3-5): Each with title, type, description, optional url/difficulty
7. Summary: Concise 1-paragraph recap
8. Next Steps (optional): 2-3 follow-up topics

IMPORTANT: Keep content focused and concise. Avoid overly long explanations or repetitive patterns.
`,

    QUALITY_STANDARDS: `
Quality Standards: Be accurate, clear, deep, practical, engaging, and well-structured.

JSON Format Rules:
- keyPoints: array of objects {point, explanation, importance?}
- resources: array of objects {title, type, description, url?, difficulty?} - at least 1 required
- All required fields must be present and non-empty
- Optional fields can be omitted or set to empty arrays
- Use valid JSON syntax
`,

    DURATION_HINT: `
Target study time: {{duration}} minutes. Adjust depth accordingly.
`,

    GENERAL_HINT: `
Create comprehensive yet focused content. Balance breadth and depth.
`,

    RETRY_HINT: `
⚠️ Previous attempt failed: {{error}}

Fix: Ensure valid JSON with all required fields (introduction, keyPoints as objects, detailedContent, resources as objects, summary).
`,
  },
} as const

/**
 * 构建 Plan Agent 提示词
 */
export function buildPlanAgentPrompt(params: {
  userGoal: string
  contextPack: string
  researchSummary?: string
}): string {
  let prompt = AGENT_PROMPTS.PLAN_AGENT.BASE
    .replace('{{userGoal}}', params.userGoal)
    .replace('{{contextPack}}', params.contextPack)
  
  if (params.researchSummary) {
    prompt += AGENT_PROMPTS.PLAN_AGENT.WITH_RESEARCH
      .replace('{{researchSummary}}', params.researchSummary)
  }
  
  prompt += AGENT_PROMPTS.PLAN_AGENT.REQUIREMENTS
  
  return prompt
}

/**
 * 构建 Schedule Agent 批次提示词
 */
export function buildScheduleBatchPrompt(params: {
  stageIndex: number
  totalStages: number
  stageTitle: string
  stageDescription: string
  durationWeeks: number
  startDate: string
  goalsAndTasks: string
  mapContext: string
}): string {
  return AGENT_PROMPTS.SCHEDULE_AGENT.BATCH_PROMPT
    .replace('{{stageIndex}}', String(params.stageIndex))
    .replace('{{totalStages}}', String(params.totalStages))
    .replace('{{stageTitle}}', params.stageTitle)
    .replace('{{stageDescription}}', params.stageDescription)
    .replace('{{durationWeeks}}', String(params.durationWeeks))
    .replace('{{durationWeeks}}', String(params.durationWeeks)) // 第二次出现
    .replace('{{startDate}}', params.startDate)
    .replace('{{goalsAndTasks}}', params.goalsAndTasks)
    .replace('{{mapContext}}', params.mapContext)
}

/**
 * 构建 Lesson Agent 提示词
 */
export function buildLessonAgentPrompt(params: {
  taskTitle: string
  taskDescription?: string
  taskType: string
  stageTitle: string
  metadata?: {
    learningObjectives?: string[]
    difficulty?: string
    suggestedDuration?: string | number
    prerequisites?: string[]
    focusAreas?: string[]
  }
  researchSummary?: string
  includeExercises?: boolean
  previousError?: string
  ragDatasetsText?: string
}): string {
  let prompt = AGENT_PROMPTS.LESSON_AGENT.BASE
    .replace('{{taskTitle}}', params.taskTitle)
    .replace('{{taskDescription}}', params.taskDescription || 'No description provided')
    .replace('{{taskType}}', params.taskType)
    .replace('{{stageTitle}}', params.stageTitle)
  
  // 添加元数据
  if (params.metadata) {
    let metadataText = ''
    if (params.metadata.learningObjectives) {
      metadataText += `\n- Learning Objectives: ${params.metadata.learningObjectives.join(', ')}`
    }
    if (params.metadata.difficulty) {
      metadataText += `\n- Difficulty Level: ${params.metadata.difficulty}`
    }
    if (params.metadata.suggestedDuration) {
      metadataText += `\n- Suggested Duration: ${params.metadata.suggestedDuration} minutes`
    }
    if (params.metadata.prerequisites) {
      metadataText += `\n- Prerequisites: ${params.metadata.prerequisites.join(', ')}`
    }
    if (params.metadata.focusAreas) {
      metadataText += `\n- Focus Areas: ${params.metadata.focusAreas.join(', ')}`
    }
    
    if (metadataText) {
      prompt += AGENT_PROMPTS.LESSON_AGENT.WITH_METADATA.replace('{{metadata}}', metadataText)
    }
  }
  
  // 添加研究结果
  if (params.researchSummary) {
    prompt += AGENT_PROMPTS.LESSON_AGENT.WITH_RESEARCH
      .replace('{{researchSummary}}', params.researchSummary)
  }
  
  // 添加质量标准
  prompt += AGENT_PROMPTS.LESSON_AGENT.QUALITY_STANDARDS
  
  // 添加要求
  prompt += params.includeExercises 
    ? AGENT_PROMPTS.LESSON_AGENT.REQUIREMENTS_WITH_EXERCISES
    : AGENT_PROMPTS.LESSON_AGENT.REQUIREMENTS_NO_EXERCISES
  
  // 添加时长提示
  if (params.metadata?.suggestedDuration) {
    prompt += AGENT_PROMPTS.LESSON_AGENT.DURATION_HINT
      .replace('{{duration}}', String(params.metadata.suggestedDuration))
  } else {
    prompt += AGENT_PROMPTS.LESSON_AGENT.GENERAL_HINT
  }
  
  // 如果是重试，添加错误提示
  if (params.previousError) {
    prompt += AGENT_PROMPTS.LESSON_AGENT.RETRY_HINT
      .replace('{{error}}', params.previousError)
  }
  
  // 注入 RAG 知识库列表（如果有）
  if (params.ragDatasetsText) {
    prompt += `\n\n${params.ragDatasetsText}`
  }
  
  return prompt
}
