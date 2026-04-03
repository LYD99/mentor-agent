/**
 * Schedule Agent Prompts
 * 
 * 用于生成成长地图的学习计划和定时任务的提示词管理
 */

interface StageBatchParams {
  stageIndex: number
  stageTitle: string
  batchIndex: number
  totalBatchesInStage: number
  startDay: number
  endDay: number
  batchDays: number
  startDate: string
  mapContext: string
  tasks: Array<{
    id: string
    title: string
    description: string
    type: string
    durationDays: number
    stageTitle: string
  }>
}

/**
 * 构建单个批次的学习计划生成 prompt
 */
export function buildBatchSchedulePrompt(params: StageBatchParams): string {
  const {
    stageIndex,
    stageTitle,
    batchIndex,
    totalBatchesInStage,
    startDay,
    endDay,
    batchDays,
    startDate,
    mapContext,
    tasks,
  } = params

  return `You are a learning schedule planner. Generate a daily learning schedule METADATA for Stage ${stageIndex + 1}: "${stageTitle}" (Batch ${batchIndex + 1}/${totalBatchesInStage}).

IMPORTANT: You are generating METADATA ONLY (learning objectives, difficulty, duration estimates).
Detailed learning content and materials will be generated later by the Lesson Agent when tasks are executed.

This batch spans days ${startDay + 1} to ${endDay} (${batchDays} days total).

Growth Map Context:
${mapContext}

Tasks in This Stage (${tasks.length} tasks):
${tasks.map((t, i) => `${i + 1}. Task ID: "${t.id}" (STRING) - [${t.type}] ${t.title} (${t.durationDays} days)\n   ${t.description}`).join("\n\n")}

Generate a daily schedule for ${batchDays} days starting from ${startDate}.

REQUIREMENTS for each day's metadata:
1. taskId: Use the EXACT Task ID from the list above (STRING type, e.g., "cm123abc")
2. taskTitle: Copy the exact task title
3. learningObjectives: Array of 2-4 key learning objectives for that day
4. difficulty: One of "beginner", "intermediate", or "advanced"
5. suggestedDuration: Time estimate as a string (e.g., "1-2 hours", "30-60 minutes")
6. prerequisites: (Optional) Array of prerequisite knowledge needed
7. focusAreas: Array of 2-3 main topics or skills to focus on

CRITICAL RULES:
- taskId MUST be a STRING with quotes (e.g., "cm123abc", NOT a number)
- Generate METADATA ONLY - keep objectives and focus areas concise (not detailed content)
- ALL required fields must be present for every task
- Only use Task IDs from the list above
- Distribute the ${batchDays} days across the ${tasks.length} tasks in this stage
- Return ONLY valid JSON matching the schema
- Do not include markdown code blocks or formatting

Focus on creating a logical learning progression with appropriate difficulty levels.`
}

/**
 * 构建批次重试时的错误提示
 */
export function buildBatchScheduleErrorPrompt(previousError: string): string {
  return `

⚠️ PREVIOUS ATTEMPT FAILED - Please fix the following error:
${previousError}

Common issues to avoid:
- Missing required field "dailySchedule"
- Invalid JSON format (remove markdown code blocks like \`\`\`json)
- Empty or undefined arrays
- Incorrect date format (must be YYYY-MM-DD)
- Missing metadata fields: learningObjectives, difficulty, suggestedDuration, focusAreas
- Invalid difficulty value (must be "beginner", "intermediate", or "advanced")
- taskId must be a STRING (with quotes)

Please carefully review the error above and ensure your output is valid JSON with all required metadata fields.`
}
