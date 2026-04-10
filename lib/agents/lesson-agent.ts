import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getEnv } from "@/lib/config/env-runtime";
import { searchWeb } from "./research";
import { buildLessonAgentPrompt } from "@/lib/prompts/agent-prompts";
import { formatRagDatasetsForPrompt } from "@/lib/services/rag-prompt-builder";
import { prisma } from "@/lib/db";
import { assessLessonQualityComprehensive, generateQualityReport, shouldRegenerate, isQualityValidationEnabled } from "./quality-validator";
import { selectLessonModelConfig, getModelConfigSummary } from "@/lib/config/model-config";
import { generateLessonMultiStep } from "./lesson-agent-multi-step";

function getOpenAIProvider() {
  const apiKey = getEnv("AI_API_KEY");
  const baseURL = getEnv("AI_BASE_URL");

  return createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}

// Enhanced Lesson Content Schema with professional fields
export const LessonContentSchema = z.object({
  // Core content sections
  introduction: z.string().describe("Compelling 2-3 paragraph introduction that hooks the learner, explains why the topic matters, and sets clear learning objectives"),
  
  keyPoints: z.array(
    z.object({
      point: z.string().describe("The key learning point"),
      explanation: z.string().describe("Brief explanation or example for this point"),
      importance: z.string().optional().describe("Why this point matters"),
    })
  ).min(3).max(7).describe("Key learning points with explanations (3-7 items)"),
  
  detailedContent: z.string().describe("Comprehensive explanation with multiple examples, analogies, code snippets, and step-by-step procedures. Use markdown formatting with clear headings."),
  
  // Common misconceptions and pitfalls
  commonMisconceptions: z.array(
    z.object({
      misconception: z.string().describe("A common misunderstanding"),
      correction: z.string().describe("The correct understanding"),
    })
  ).optional().describe("Common misconceptions and their corrections"),
  
  // Practical applications
  realWorldApplications: z.array(z.string()).optional().describe("Real-world use cases and applications of this knowledge"),
  
  // Practice exercises
  exercises: z
    .array(
      z.object({
        question: z.string().describe("The exercise question or prompt"),
        type: z.enum(["multiple_choice", "short_answer", "coding", "essay"]),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        options: z.array(z.string()).optional().describe("Options for multiple choice questions"),
        answer: z.string().describe("The correct answer"),
        explanation: z.string().describe("Detailed explanation of the answer and why it's correct"),
        hints: z.array(z.string()).optional().describe("Progressive hints to help solve the problem"),
      }),
    )
    .optional()
    .describe("Practice exercises with progressive difficulty, answers, and detailed explanations"),
  
  // Learning resources
  resources: z.array(
    z.object({
      title: z.string().describe("Resource title"),
      url: z.string().optional().describe("Resource URL if available"),
      type: z.enum(["documentation", "tutorial", "video", "article", "book", "course", "tool"]),
      description: z.string().describe("Brief description of what this resource offers"),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    })
  ).describe("Curated, high-quality learning resources with annotations"),
  
  // Summary and next steps
  summary: z.string().describe("Concise summary of what was learned"),
  nextSteps: z.array(z.string()).optional().describe("Suggested next steps or topics to explore"),
  
  // Metadata for quality assurance
  estimatedStudyTime: z.number().optional().describe("Estimated study time in minutes"),
  prerequisites: z.array(z.string()).optional().describe("Concepts or skills needed before this lesson"),
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
  userId?: string; // 用于加载 RAG 配置
  onProgress?: (step: number, total: number, message: string) => void; // 进度回调
  knownMaterials?: string; // 已知的参考资料（完整内容）
}

/**
 * 验证生成的课程内容 - 增强版
 */
function validateLessonContent(content: unknown): content is LessonContent {
  try {
    if (!content || typeof content !== "object") return false;
    
    const obj = content as any;
    
    // 验证必需字段
    if (!obj.introduction || typeof obj.introduction !== "string" || obj.introduction.length < 100) {
      console.warn('[Lesson Validation] Introduction is missing or too short');
      return false;
    }
    
    if (!Array.isArray(obj.keyPoints) || obj.keyPoints.length < 3 || obj.keyPoints.length > 7) {
      console.warn('[Lesson Validation] Key points must be 3-7 items');
      return false;
    }
    
    // 验证 keyPoints 的新结构
    for (const kp of obj.keyPoints) {
      if (!kp.point || !kp.explanation) {
        console.warn('[Lesson Validation] Key point missing point or explanation');
        return false;
      }
    }
    
    if (!obj.detailedContent || obj.detailedContent.length < 200) {
      console.warn('[Lesson Validation] Detailed content is missing or too short (min 200 chars)');
      return false;
    }
    
    if (!Array.isArray(obj.resources) || obj.resources.length === 0) {
      console.warn('[Lesson Validation] Resources are missing');
      return false;
    }
    
    // 验证 resources 的新结构
    for (const res of obj.resources) {
      if (!res.title || !res.type || !res.description) {
        console.warn('[Lesson Validation] Resource missing required fields');
        return false;
      }
    }
    
    if (!obj.summary || obj.summary.length < 50) {
      console.warn('[Lesson Validation] Summary is missing or too short');
      return false;
    }
    
    // 验证练习题格式（如果存在）
    if (obj.exercises) {
      if (!Array.isArray(obj.exercises)) {
        console.warn('[Lesson Validation] Exercises must be an array');
        return false;
      }
      for (const ex of obj.exercises) {
        if (!ex.question || !ex.type || !ex.answer || !ex.explanation) {
          console.warn('[Lesson Validation] Exercise missing required fields');
          return false;
        }
        if (ex.type === 'multiple_choice' && (!ex.options || ex.options.length < 2)) {
          console.warn('[Lesson Validation] Multiple choice exercise needs at least 2 options');
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('[Lesson Validation] Validation error:', error);
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
 * 
 * 注意：重试逻辑已在 generateLessonMultiStep 内部实现，这里不再重复包装
 */
export async function generateLesson(
  params: LessonParams,
): Promise<LessonContent> {
  // 直接调用多步骤生成（内部已有重试机制）
  return generateLessonMultiStep({
    taskTitle: params.taskTitle,
    taskDescription: params.taskDescription,
    taskType: params.taskType,
    stageTitle: params.stageTitle,
    metadata: params.metadata,
    includeExercises: params.includeExercises,
    abortSignal: params.abortSignal,
    knownMaterials: params.knownMaterials,
  }, params.onProgress);
}
