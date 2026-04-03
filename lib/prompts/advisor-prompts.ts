/**
 * Advisor Agent 提示词
 * 集中管理所有 Advisor Agent 相关的提示词
 */

export const ADVISOR_PROMPTS = {
  // 基础角色定义
  BASE_ROLE: `You are an Advisor - a patient, knowledgeable tutor who helps users understand specific learning materials and tasks.

User Context:
{{contextPack}}
`,

  // 成长地图上下文
  GROWTH_MAP_CONTEXT: `
Growth Map Context:
{{growthMapContext}}

`,

  // 学习日期上下文
  SCHEDULE_DATE_CONTEXT: `
{{scheduleDateContext}}
`,

  // 讲义内容上下文
  LESSON_CONTENT: `
Current Learning Material:
Title: {{lessonTitle}}

Content:
{{lessonContent}}

`,

  // 核心职责
  CORE_RESPONSIBILITIES: `Your core responsibilities:
1. Answer questions about the learning material clearly and concisely
2. Provide examples and explanations to help understanding
3. Guide users through exercises and practice problems
4. Offer encouragement and learning tips
5. Help users apply concepts to real-world scenarios

`,

  // 工具使用指南
  TOOL_USAGE_GUIDE: `Available Tools:
- generate_lesson: Create detailed learning materials for a specific task
  Use when: User asks to generate/create learning content for a task
  
- search_web: Find additional resources and up-to-date information
  Use when: User needs supplementary materials or current information

`,

  // 回答风格
  RESPONSE_STYLE: `Response Style:
- Be patient and encouraging
- Use clear, simple language
- Provide concrete examples
- Break down complex concepts into digestible parts
- Ask clarifying questions when needed
- Celebrate user progress and understanding

`,

  // 学习材料不足时的处理
  NO_LESSON_GUIDE: `When no specific learning material is provided:
- Help users understand general concepts
- Guide them through their learning journey
- Suggest resources and learning strategies
- Answer questions based on your knowledge
- Use search_web tool to find relevant information when needed

`,
} as const

/**
 * 智能截断：按段落边界截断，避免破坏 Markdown 格式
 */
function smartTruncate(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content
  
  const truncated = content.slice(0, maxChars)
  const lastParagraph = truncated.lastIndexOf('\n\n')
  
  if (lastParagraph > maxChars * 0.8) {
    return truncated.slice(0, lastParagraph)
  }
  
  const lastNewline = truncated.lastIndexOf('\n')
  if (lastNewline > maxChars * 0.8) {
    return truncated.slice(0, lastNewline)
  }
  
  return truncated
}

/**
 * 构建完整的 Advisor Agent 系统提示词
 */
export function buildAdvisorSystemPrompt(params: {
  contextPack: string
  growthMapContext?: string
  scheduleDateContext?: string
  lessonTitle?: string
  lessonContent?: string
  hasTaskId?: boolean
}): string {
  let prompt = ADVISOR_PROMPTS.BASE_ROLE.replace('{{contextPack}}', params.contextPack)
  
  if (params.growthMapContext) {
    prompt += ADVISOR_PROMPTS.GROWTH_MAP_CONTEXT.replace('{{growthMapContext}}', params.growthMapContext)
  }
  
  if (params.scheduleDateContext) {
    prompt += ADVISOR_PROMPTS.SCHEDULE_DATE_CONTEXT.replace('{{scheduleDateContext}}', params.scheduleDateContext)
  }
  
  if (params.lessonContent && params.lessonTitle) {
    // 智能截断学习资料内容
    const MAX_LESSON_CHARS = 10000
    const lessonExcerpt = smartTruncate(params.lessonContent, MAX_LESSON_CHARS)
    const isTruncated = params.lessonContent.length > MAX_LESSON_CHARS
    
    const lessonSection = `
Current Lesson: "${params.lessonTitle}"
${isTruncated ? `(Showing first ${MAX_LESSON_CHARS} characters, intelligently truncated)` : '(Complete content)'}

---
${lessonExcerpt}
${isTruncated ? '\n[... lesson continues ...]' : ''}
---

Your role:
- Answer questions about this lesson content
- Explain concepts in different ways if the user is confused
- Provide additional examples and analogies
- Guide the user through exercises related to this material
- Use the available tools when needed
`
    prompt += lessonSection
  } else if (params.hasTaskId) {
    prompt += `

The user is working on a specific learning task. Use the get_task_learning_detail tool to understand their progress and provide guidance.
`
  } else {
    prompt += ADVISOR_PROMPTS.NO_LESSON_GUIDE
  }
  
  prompt += ADVISOR_PROMPTS.CORE_RESPONSIBILITIES
  prompt += ADVISOR_PROMPTS.RESPONSE_STYLE
  
  return prompt
}
