/**
 * 多步骤学习资料生成器
 * 将复杂的学习资料生成拆分为多个小步骤，避免 JSON 截断问题
 */

import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getEnv } from "@/lib/config/env-runtime";
import { selectLessonModelConfig } from "@/lib/config/model-config";
import { assessLessonQualityComprehensive, generateQualityReport, shouldRegenerate, isQualityValidationEnabled } from "./quality-validator";
import { withAgentRetry } from "./agent-retry";

function getOpenAIProvider() {
  const apiKey = getEnv("AI_API_KEY");
  const baseURL = getEnv("AI_BASE_URL");
  if (!apiKey) {
    throw new Error("Missing AI_API_KEY");
  }
  return createOpenAI({ apiKey, baseURL });
}

/**
 * 构建 generateObject 参数，只添加有值的可选参数（避免传递 undefined）
 * DeepSeek 模型不支持某些参数，传递 undefined 会导致失败
 */
function buildGenerateParams(
  model: any,
  schema: any,
  prompt: string,
  modelConfig: any,
  abortSignal?: AbortSignal,
  maxTokensOverride?: number
): any {
  const params: any = {
    model,
    schema,
    prompt,
    temperature: modelConfig.temperature,
    abortSignal,
  };
  
  // 只在有具体值时才添加可选参数
  const maxTokens = maxTokensOverride ?? modelConfig.maxTokens;
  if (maxTokens !== undefined) {
    params.maxTokens = maxTokens;
  }
  if (modelConfig.topP !== undefined) {
    params.topP = modelConfig.topP;
  }
  if (modelConfig.frequencyPenalty !== undefined) {
    params.frequencyPenalty = modelConfig.frequencyPenalty;
  }
  if (modelConfig.presencePenalty !== undefined) {
    params.presencePenalty = modelConfig.presencePenalty;
  }
  
  return params;
}

// Step 1: 生成大纲和关键点
const OutlineSchema = z.object({
  introduction: z.string().describe("2-3段引言"),
  keyPoints: z.array(
    z.object({
      point: z.string(),
      explanation: z.string(),
      importance: z.string().optional(),
    })
  ).min(3).max(7),
  summary: z.string().describe("总结"),
});

// Step 2: 生成详细内容（分段）
const DetailedContentSchema = z.object({
  content: z.string().describe("详细内容的一个部分，包含示例和代码"),
  sectionTitle: z.string().describe("这部分的标题"),
});

// Step 3: 生成误区和应用
const MisconceptionsAndApplicationsSchema = z.object({
  commonMisconceptions: z.array(
    z.object({
      misconception: z.string(),
      correction: z.string(),
    })
  ).optional(),
  realWorldApplications: z.array(z.string()).optional(),
});

// Step 4: 生成练习题
const ExercisesSchema = z.object({
  exercises: z.array(
    z.object({
      question: z.string(),
      type: z.enum(["multiple_choice", "short_answer", "coding", "essay"]),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      options: z.array(z.string()).optional(),
      answer: z.string(),
      explanation: z.string(),
      hints: z.array(z.string()).optional(),
    })
  ).optional(),
});

// Step 5: 生成学习资源
const ResourcesSchema = z.object({
  resources: z.array(
    z.object({
      title: z.string(),
      url: z.string().optional(),
      type: z.enum(["documentation", "tutorial", "video", "article", "book", "course", "tool"]),
      description: z.string(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    })
  ),
  nextSteps: z.array(z.string()).optional(),
  estimatedStudyTime: z.number().optional(),
  prerequisites: z.array(z.string()).optional(),
});

// 最终组合的完整 Schema
export const LessonContentSchema = z.object({
  introduction: z.string(),
  keyPoints: z.array(
    z.object({
      point: z.string(),
      explanation: z.string(),
      importance: z.string().optional(),
    })
  ).min(3).max(7),
  detailedContent: z.string(),
  commonMisconceptions: z.array(
    z.object({
      misconception: z.string(),
      correction: z.string(),
    })
  ).optional(),
  realWorldApplications: z.array(z.string()).optional(),
  exercises: z.array(
    z.object({
      question: z.string(),
      type: z.enum(["multiple_choice", "short_answer", "coding", "essay"]),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      options: z.array(z.string()).optional(),
      answer: z.string(),
      explanation: z.string(),
      hints: z.array(z.string()).optional(),
    })
  ).optional(),
  resources: z.array(
    z.object({
      title: z.string(),
      url: z.string().optional(),
      type: z.enum(["documentation", "tutorial", "video", "article", "book", "course", "tool"]),
      description: z.string(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    })
  ),
  summary: z.string(),
  nextSteps: z.array(z.string()).optional(),
  estimatedStudyTime: z.number().optional(),
  prerequisites: z.array(z.string()).optional(),
});

export type LessonContent = z.infer<typeof LessonContentSchema>;

export interface MultiStepLessonParams {
  taskTitle: string;
  taskDescription?: string;
  taskType: string;
  stageTitle?: string;
  metadata?: {
    learningObjectives?: string[];
    difficulty?: string;
    suggestedDuration?: string | number;
    prerequisites?: string[];
    focusAreas?: string[];
  };
  includeExercises?: boolean;
  abortSignal?: AbortSignal;
  knownMaterials?: string; // 完整的参考资料（不截断）
}

/**
 * 多步骤生成学习资料（内部实现，不包含重试逻辑）
 */
async function generateLessonMultiStepInternal(
  params: MultiStepLessonParams,
  onProgress?: (step: number, total: number, message: string) => void
): Promise<LessonContent> {
  const openaiProvider = getOpenAIProvider();
  const modelConfig = selectLessonModelConfig({
    difficulty: params.metadata?.difficulty as any,
    includeResearch: false,
    includeExercises: params.includeExercises,
    taskType: params.taskType,
  });

  const totalSteps = params.includeExercises ? 5 : 4;
  onProgress?.(0, totalSteps, `开始生成学习资料: ${params.taskTitle}`);

  // 基础上下文
  let baseContext = `
Task: ${params.taskTitle}
Description: ${params.taskDescription || 'No description'}
Type: ${params.taskType}
Difficulty: ${params.metadata?.difficulty || 'intermediate'}
${params.metadata?.learningObjectives ? `Learning Objectives:\n${params.metadata.learningObjectives.map(o => `- ${o}`).join('\n')}` : ''}
`;

  // 如果有 knownMaterials，添加到上下文中（用于生成器参考）
  if (params.knownMaterials) {
    // 对于生成器，使用完整的 knownMaterials（不截断）
    baseContext += `\n\nReference Materials:\n${params.knownMaterials}\n`;
  }

  // Step 1: 生成大纲和关键点（带步骤级重试）
  onProgress?.(1, totalSteps, '正在生成引言、关键点和总结...');
  
  const outline = await withAgentRetry(
    {
      agentName: "Lesson Agent",
      operation: "generate outline (step 1/5)",
      paramsPreview: params.taskTitle.substring(0, 30),
      maxRetries: 3,
      retryDelayMs: 1000,
      abortSignal: params.abortSignal,
    },
    async () => {
      const generateParams1 = buildGenerateParams(
        openaiProvider(modelConfig.model),
        OutlineSchema,
        `${baseContext}

Generate a compelling introduction (2-3 paragraphs), key learning points (3-7 items), and a summary for this learning material.

Requirements:
- Introduction should hook the learner and explain why this topic matters
- Each key point should have: point, explanation, and importance
- Summary should be concise (1 paragraph)

Return valid JSON only.`,
        modelConfig,
        params.abortSignal,
        3000 // 大纲不需要太多 tokens
      );

      const outlineResult = await generateObject(generateParams1);
      return outlineResult.object as z.infer<typeof OutlineSchema>;
    }
  );
  
  onProgress?.(1, totalSteps, `步骤 1 完成: ${outline.keyPoints.length} 个关键点`);

  // Step 2: 生成详细内容（分为 2-3 个部分）
  const numSections = Math.min(params.metadata?.focusAreas?.length || 2, 3);
  onProgress?.(2, totalSteps, `正在生成 ${numSections} 个内容章节...`);
  const contentSections: string[] = [];

  for (let i = 0; i < numSections; i++) {
    const focusArea = params.metadata?.focusAreas?.[i] || outline.keyPoints[i]?.point || `Section ${i + 1}`;
    
    // 每个章节独立重试
    const section = await withAgentRetry(
      {
        agentName: "Lesson Agent",
        operation: `generate section ${i + 1}/${numSections} (step 2/5)`,
        paramsPreview: focusArea.substring(0, 30),
        maxRetries: 3,
        retryDelayMs: 1000,
        abortSignal: params.abortSignal,
      },
      async () => {
        const generateParams2 = buildGenerateParams(
          openaiProvider(modelConfig.model),
          DetailedContentSchema,
          `${baseContext}

Generate detailed content for this section: "${focusArea}"

Requirements:
- In-depth explanation with 1-2 practical examples
- Include code snippets if relevant (10-20 lines max)
- Use markdown ## for subsections
- Keep it focused and concise (avoid repetition)

Return valid JSON with 'sectionTitle' and 'content' fields.`,
          modelConfig,
          params.abortSignal,
          2000 // 每个部分 2000 tokens
        );

        const sectionResult = await generateObject(generateParams2);
        return sectionResult.object as z.infer<typeof DetailedContentSchema>;
      }
    );
    
    contentSections.push(`## ${section.sectionTitle}\n\n${section.content}`);
    onProgress?.(2, totalSteps, `章节 ${i + 1}/${numSections} 完成: ${section.sectionTitle}`);
  }

  // Step 3: 生成误区和应用（带步骤级重试）
  onProgress?.(3, totalSteps, '正在生成常见误区和实际应用场景...');
  
  const misconceptionsAndApps = await withAgentRetry(
    {
      agentName: "Lesson Agent",
      operation: "generate misconceptions & applications (step 3/5)",
      paramsPreview: params.taskTitle.substring(0, 30),
      maxRetries: 3,
      retryDelayMs: 1000,
      abortSignal: params.abortSignal,
    },
    async () => {
      const generateParams3 = buildGenerateParams(
        openaiProvider(modelConfig.model),
        MisconceptionsAndApplicationsSchema,
        `${baseContext}

Generate common misconceptions and real-world applications for this topic.

Requirements:
- 2-3 common misconceptions with corrections
- 2-3 brief real-world applications

Return valid JSON.`,
        modelConfig,
        params.abortSignal,
        1500
      );

      const misconceptionsAndAppsResult = await generateObject(generateParams3);
      return misconceptionsAndAppsResult.object as z.infer<typeof MisconceptionsAndApplicationsSchema>;
    }
  );
  
  const misconceptionsCount = misconceptionsAndApps.commonMisconceptions?.length || 0;
  const applicationsCount = misconceptionsAndApps.realWorldApplications?.length || 0;
  onProgress?.(3, totalSteps, `步骤 3 完成: ${misconceptionsCount} 个误区, ${applicationsCount} 个应用`);

  // Step 4: 生成练习题（如果需要，带步骤级重试）
  let exercises: any[] | undefined;
  let currentStep = 4;
  if (params.includeExercises) {
    onProgress?.(4, totalSteps, '正在生成练习题...');
    
    const exercisesData = await withAgentRetry(
      {
        agentName: "Lesson Agent",
        operation: "generate exercises (step 4/5)",
        paramsPreview: params.taskTitle.substring(0, 30),
        maxRetries: 3,
        retryDelayMs: 1000,
        abortSignal: params.abortSignal,
      },
      async () => {
        const generateParams4 = buildGenerateParams(
          openaiProvider(modelConfig.model),
          ExercisesSchema,
          `${baseContext}

Generate 2-4 practice exercises for this topic.

Requirements:
- Mix of different types (multiple_choice, short_answer, coding)
- Include difficulty levels
- Provide detailed explanations
- Add hints for harder questions

Return valid JSON.`,
          modelConfig,
          params.abortSignal,
          2000
        );

        const exercisesResult = await generateObject(generateParams4);
        return exercisesResult.object as z.infer<typeof ExercisesSchema>;
      }
    );
    
    exercises = exercisesData.exercises;
    onProgress?.(4, totalSteps, `步骤 4 完成: ${exercises?.length || 0} 道练习题`);
    currentStep = 5;
  } else {
    currentStep = 4;
  }

  // Step 5: 生成学习资源（带步骤级重试）
  onProgress?.(currentStep, totalSteps, '正在生成学习资源和后续步骤...');
  
  const resourcesResult = await withAgentRetry(
    {
      agentName: "Lesson Agent",
      operation: `generate resources (step ${currentStep}/5)`,
      paramsPreview: params.taskTitle.substring(0, 30),
      maxRetries: 3,
      retryDelayMs: 1000,
      abortSignal: params.abortSignal,
    },
    async () => {
      const generateParams5 = buildGenerateParams(
        openaiProvider(modelConfig.model),
        ResourcesSchema,
        `${baseContext}

Generate learning resources and next steps for this topic.

Requirements:
- 3-5 high-quality learning resources (documentation, tutorials, articles, etc.)
- Each resource should have title, type, description, and optional URL
- 2-3 suggested next steps
- Estimate study time in minutes
- List prerequisites if any

Return valid JSON.`,
        modelConfig,
        params.abortSignal,
        1500
      );

      const resourcesResultData = await generateObject(generateParams5);
      return resourcesResultData.object as z.infer<typeof ResourcesSchema>;
    }
  );
  
  onProgress?.(currentStep, totalSteps, `步骤 ${currentStep} 完成: ${resourcesResult.resources.length} 个资源`);

  // 组合所有部分
  onProgress?.(totalSteps, totalSteps, '正在组合所有内容...');
  const finalContent: LessonContent = {
    introduction: outline.introduction,
    keyPoints: outline.keyPoints,
    detailedContent: contentSections.join('\n\n'),
    commonMisconceptions: misconceptionsAndApps.commonMisconceptions,
    realWorldApplications: misconceptionsAndApps.realWorldApplications,
    exercises,
    resources: resourcesResult.resources,
    summary: outline.summary,
    nextSteps: resourcesResult.nextSteps,
    estimatedStudyTime: resourcesResult.estimatedStudyTime,
    prerequisites: resourcesResult.prerequisites,
  };

  onProgress?.(totalSteps, totalSteps, '学习资料生成完成！');
  
  return finalContent;
}

/**
 * 多步骤生成学习资料（带重试和质量验证）
 */
export async function generateLessonMultiStep(
  params: MultiStepLessonParams,
  onProgress?: (step: number, total: number, message: string) => void
): Promise<LessonContent> {
  // 如果质量验证未启用，直接调用内部实现
  if (!isQualityValidationEnabled()) {
    return generateLessonMultiStepInternal(params, onProgress);
  }

  // 使用 withAgentRetry 包装，支持质量验证和重试
  return withAgentRetry(
    {
      agentName: "Lesson Agent",
      operation: "generate lesson",
      paramsPreview: params.taskTitle.substring(0, 50),
      maxRetries: 3,
      retryDelayMs: 1000,
      abortSignal: params.abortSignal,
      buildPrompt: (previousError) => {
        // 这里不需要返回 prompt，因为多步骤生成不依赖单一 prompt
        // 但我们可以返回错误信息用于日志
        return previousError || "";
      },
    },
    async (errorFeedback, attempt) => {
      // 如果是重试，在进度回调中提示
      if (attempt > 1 && onProgress) {
        onProgress(0, 1, `正在重试生成学习资料 (第 ${attempt} 次尝试)...`);
      }

      // 执行多步骤生成
      const content = await generateLessonMultiStepInternal(params, onProgress);

      // 质量验证（在 withAgentRetry 回调内部执行）
      console.log('[Multi-Step Lesson] 🔍 开始质量评估（代码 + LLM 双重验证）...');
      
      const qualityScore = await assessLessonQualityComprehensive(
        content,
        params.taskTitle,
        params.abortSignal
      );
      
      const qualityReport = generateQualityReport(qualityScore);
      console.log(qualityReport);
      
      // 如果有 LLM 评估结果，打印详细信息
      if (qualityScore.llmAssessment) {
        console.log('\n=== LLM Quality Assessment ===');
        console.log(`Score: ${qualityScore.llmAssessment.score}/100`);
        console.log(`Passed: ${qualityScore.llmAssessment.passed ? '✓' : '✗'}`);
        console.log(`Feedback: ${qualityScore.llmAssessment.feedback}`);
        console.log(`Strengths: ${qualityScore.llmAssessment.strengths.join(', ')}`);
        if (qualityScore.llmAssessment.weaknesses.length > 0) {
          console.log(`Weaknesses: ${qualityScore.llmAssessment.weaknesses.join(', ')}`);
        }
        console.log('==============================\n');
      }
      
      // 如果质量不达标，抛出错误（触发重试）
      if (shouldRegenerate(qualityScore)) {
        const errorParts = [
          `Lesson quality below threshold.`,
          `Code score: ${qualityScore.overall}/100 (${qualityScore.passed ? 'passed' : 'failed'})`,
        ];
        
        if (qualityScore.llmAssessment) {
          errorParts.push(
            `LLM score: ${qualityScore.llmAssessment.score}/100 (${qualityScore.llmAssessment.passed ? 'passed' : 'failed'})`
          );
        }
        
        errorParts.push(`Issues: ${qualityScore.issues.slice(0, 3).join('; ')}`);
        errorParts.push(`Suggestions: ${qualityScore.suggestions.slice(0, 3).join('; ')}`);
        
        throw new Error(errorParts.join(' | '));
      }
      
      console.log(`[Multi-Step Lesson] ✅ 质量评估通过 (Code: ${qualityScore.overall}/100${qualityScore.llmAssessment ? `, LLM: ${qualityScore.llmAssessment.score}/100` : ''})`);
      
      return content;
    }
  );
}

/**
 * 验证生成的内容
 */
export function validateLessonContent(content: unknown): content is LessonContent {
  try {
    LessonContentSchema.parse(content);
    return true;
  } catch {
    return false;
  }
}
