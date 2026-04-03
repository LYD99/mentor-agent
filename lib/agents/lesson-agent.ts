import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getEnv } from "@/lib/config/env-runtime";
import { withAgentRetry } from "./agent-retry";
import { searchWeb } from "./research";
import { buildLessonAgentPrompt } from "@/lib/prompts/agent-prompts";

function getOpenAIProvider() {
  const apiKey = getEnv("AI_API_KEY");
  const baseURL = getEnv("AI_BASE_URL");

  return createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}

// Lesson Content Schema
export const LessonContentSchema = z.object({
  introduction: z.string().describe("Brief introduction to the topic"),
  keyPoints: z.array(z.string()).describe("Key learning points (3-7 items)"),
  detailedContent: z.string().describe("Detailed explanation with examples"),
  exercises: z
    .array(
      z.object({
        question: z.string(),
        type: z.enum(["multiple_choice", "short_answer", "coding", "essay"]),
        options: z.array(z.string()).optional(),
        answer: z.string(),
        explanation: z.string(),
      }),
    )
    .optional()
    .describe("Practice exercises with answers and explanations"),
  resources: z
    .array(z.string())
    .describe("Additional learning resources (URLs, book names, etc.)"),
});

export type LessonContent = z.infer<typeof LessonContentSchema>;

// Lesson Generation Parameters（v2.5: 移除 goalTitle）
export interface LessonParams {
  taskTitle: string;
  taskDescription?: string;
  taskType: string;
  stageTitle: string;
  
  // 元数据（来自 Schedule Agent）
  metadata?: {
    learningObjectives?: string[];
    difficulty?: "beginner" | "intermediate" | "advanced";
    suggestedDuration?: number;
    prerequisites?: string[];
    focusAreas?: string[];
  };
  
  // 可选配置
  includeExercises?: boolean;
  includeResearch?: boolean;
  abortSignal?: AbortSignal;
}

/**
 * 验证生成的课程内容
 */
function validateLessonContent(content: unknown): content is LessonContent {
  try {
    if (!content || typeof content !== "object") return false;
    
    const obj = content as any;
    
    if (!obj.introduction || typeof obj.introduction !== "string") return false;
    if (!Array.isArray(obj.keyPoints) || obj.keyPoints.length === 0) return false;
    if (!obj.detailedContent || obj.detailedContent.length < 50) return false;
    if (!Array.isArray(obj.resources)) return false;
    
    // 如果有练习题，验证格式
    if (obj.exercises) {
      if (!Array.isArray(obj.exercises)) return false;
      for (const ex of obj.exercises) {
        if (!ex.question || !ex.type || !ex.answer || !ex.explanation) {
          return false;
        }
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Lesson Agent - 生成学习资料
 * 
 * 功能：
 * 1. 基于任务信息和元数据生成详细学习内容
 * 2. 可选：使用 research 工具搜索相关学习资源
 * 3. 支持重试机制和错误反馈
 * 4. 生成练习题和学习资源推荐
 */
export async function generateLesson(
  params: LessonParams,
): Promise<LessonContent> {
  const apiKey = getEnv("AI_API_KEY");
  if (!apiKey?.trim()) {
    throw new Error("Missing AI_API_KEY");
  }

  const openaiProvider = getOpenAIProvider();
  
  // 如果启用了 research，先搜索相关资源
  let researchSummary = '';
  if (params.includeResearch) {
    console.log('[Lesson Agent] Research enabled, searching for resources...');
    try {
      const searchQuery = params.metadata?.learningObjectives
        ? `${params.taskTitle} ${params.metadata.learningObjectives.join(' ')}`
        : params.taskTitle;
      
      const searchResults = await searchWeb(searchQuery);
      researchSummary = searchResults
        .map((r) => `- ${r.title} (${r.url}): ${r.snippet}`)
        .join('\n');
      
      console.log('[Lesson Agent] Research completed, found', searchResults.length, 'results');
    } catch (error) {
      console.warn('[Lesson Agent] Research failed, continuing without it:', error);
    }
  }

  return withAgentRetry(
    {
      agentName: "Lesson Agent",
      operation: "generate lesson content",
      paramsPreview: `${params.taskTitle} (${params.metadata?.difficulty || 'unknown'}, ${params.metadata?.suggestedDuration || '?'}min)`,
      maxRetries: 3,
      retryDelayMs: 1000,
      abortSignal: params.abortSignal,
      buildPrompt: (previousError) => {
        // 使用统一的 prompts 模块构建 Prompt
        return buildLessonAgentPrompt({
          taskTitle: params.taskTitle,
          taskDescription: params.taskDescription,
          taskType: params.taskType,
          stageTitle: params.stageTitle,
          metadata: params.metadata,
          researchSummary,
          includeExercises: params.includeExercises,
          previousError,
        });
      },
    },
    async (prompt) => {
      // 执行实际的 AI 调用
      const { object } = await generateObject({
        model: openaiProvider(getEnv("AI_MODEL") || "gpt-4o-mini"),
        schema: LessonContentSchema,
        prompt,
        temperature: 0.7,
        abortSignal: params.abortSignal,
      });

      // 验证生成的内容
      if (!validateLessonContent(object)) {
        const obj = object as any;
        throw new Error(
          "Generated lesson content is invalid or incomplete. " +
          `Missing: ${!obj.introduction ? 'introduction ' : ''}` +
          `${!obj.keyPoints || obj.keyPoints.length === 0 ? 'keyPoints ' : ''}` +
          `${!obj.detailedContent || obj.detailedContent.length < 50 ? 'detailedContent ' : ''}` +
          `${!obj.resources ? 'resources' : ''}`
        );
      }

      return object as LessonContent;
    },
  );
}
