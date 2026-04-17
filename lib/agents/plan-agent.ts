import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { GrowthMapSchema, type GrowthMapData } from "./plan-schema";
import { getEnv } from "@/lib/config/env-runtime";
import { withAgentRetry } from "./agent-retry";
import { truncateForLog } from "@/lib/utils/text-truncate";
import { selectPlanModelConfig, getModelConfigSummary } from "@/lib/config/model-config";
import { 
  assessGrowthMapQualityComprehensive, 
  generateQualityReport, 
  shouldRegenerate,
  isQualityValidationEnabled 
} from "./quality-validator";

function getOpenAIProvider() {
  const apiKey = getEnv("AI_API_KEY");
  const baseURL = getEnv("AI_BASE_URL");

  return createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function validateGrowthMap(data: any): data is GrowthMapData {
  try {
    // Basic structure validation
    if (!data || typeof data !== "object") return false;
    if (!data.title || typeof data.title !== "string") return false;
    if (!data.description || typeof data.description !== "string") return false;
    if (!Array.isArray(data.stages) || data.stages.length === 0) return false;

    // Validate each stage
    for (const stage of data.stages) {
      if (!stage.title || !stage.description) return false;
      if (typeof stage.durationWeeks !== "number" || stage.durationWeeks <= 0)
        return false;
      if (!Array.isArray(stage.goals) || stage.goals.length === 0) return false;

      // Validate each goal
      for (const goal of stage.goals) {
        if (!goal.title || !goal.description) return false;
        if (!Array.isArray(goal.tasks) || goal.tasks.length === 0) return false;

        // Validate each task
        for (const task of goal.tasks) {
          if (!task.title || !task.description) return false;
          if (!["learn", "practice", "test", "reflect"].includes(task.type))
            return false;
          if (typeof task.durationDays !== "number" || task.durationDays <= 0)
            return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function generateGrowthMap(params: {
  userGoal: string;
  contextPack: string;
  researchSummary?: string;
  abortSignal?: AbortSignal;
}): Promise<GrowthMapData> {
  console.log(
    `[Plan Agent] Starting generate growth map: ${truncateForLog(params.userGoal)}` +
    (params.researchSummary ? ` (with research: ${truncateForLog(params.researchSummary)})` : '')
  );
  
  const apiKey = getEnv("AI_API_KEY");
  if (!apiKey?.trim()) {
    throw new Error("Missing AI_API_KEY");
  }

  const openaiProvider = getOpenAIProvider();

  return withAgentRetry(
    {
      agentName: "Plan Agent",
      operation: "generate growth map",
      paramsPreview: params.userGoal.substring(0, 50),
      maxRetries: MAX_RETRIES,
      retryDelayMs: RETRY_DELAY_MS,
      abortSignal: params.abortSignal,
      buildPrompt: (previousError) => {
        let prompt = `Generate a structured growth/learning map for the following user.

IMPORTANT: You MUST return a valid JSON object that follows this structure:
- title: string (concise, descriptive title)
- description: string (1-2 sentences overview)
- stages: array of stage objects, each with:
  - title: string
  - description: string
  - durationWeeks: number (positive integer)
  - goals: array of goal objects, each with:
    - title: string
    - description: string
    - tasks: array of task objects, each with:
      - title: string
      - description: string
      - type: one of "learn", "practice", "test", "reflect"
      - durationDays: number (positive integer)

Context:
${params.contextPack}

Goal:
${params.userGoal}

${params.researchSummary ? `Research Results:\n${params.researchSummary}\n` : ''}

Create a comprehensive learning path with at least 2-4 stages, each with 2-3 goals, and each goal with 3-5 tasks.`;

        // Add error feedback for retry attempts
        if (previousError) {
          prompt += `

⚠️ PREVIOUS ATTEMPT FAILED - Please fix the following error:
${previousError}

Please carefully review the error above and adjust your output to ensure it meets all requirements.`;
        }

        return prompt;
      },
    },
    async (prompt) => {
      // 选择最优模型配置
      const modelConfig = selectPlanModelConfig();
      
      // 构建 generateObject 参数，只在有值时才传递（避免传递 undefined）
      const generateParams: any = {
        model: openaiProvider(modelConfig.model),
        schema: GrowthMapSchema,
        prompt,
        temperature: modelConfig.temperature,
        abortSignal: params.abortSignal,
      };
      
      // 只在有具体值时才添加可选参数（DeepSeek 不支持某些参数）
      if (modelConfig.maxTokens !== undefined) {
        generateParams.maxTokens = modelConfig.maxTokens;
      }
      if (modelConfig.topP !== undefined) {
        generateParams.topP = modelConfig.topP;
      }
      if (modelConfig.frequencyPenalty !== undefined) {
        generateParams.frequencyPenalty = modelConfig.frequencyPenalty;
      }
      if (modelConfig.presencePenalty !== undefined) {
        generateParams.presencePenalty = modelConfig.presencePenalty;
      }
      
      const { object } = await generateObject(generateParams);
      
      console.log(`[Plan Agent] generateObject returned successfully`);
      console.log(`[Plan Agent] Object keys:`, Object.keys(object || {}));

      // Validate the generated object
      if (!validateGrowthMap(object)) {
        console.error(`[Plan Agent] Validation failed for object:`, JSON.stringify(object, null, 2));
        throw new Error("Generated map does not match required structure");
      }

      // 质量评估
      if (isQualityValidationEnabled()) {
        console.log('[Plan Agent] 🔍 开始质量评估（代码 + LLM 双重验证）...');
        
        // 将嵌套结构转换为扁平结构（用于质量评估）
        const flattenedData = {
          title: object.title,
          description: object.description,
          stages: object.stages.map((stage: any) => ({
            title: stage.title,
            description: stage.description,
            tasks: stage.goals.flatMap((goal: any) => goal.tasks),
          })),
        };
        
        const qualityScore = await assessGrowthMapQualityComprehensive(
          flattenedData,
          params.userGoal,
          params.abortSignal
        );
        
        const qualityReport = generateQualityReport(qualityScore);
        console.log(qualityReport);
        
        // 记录详细的 LLM 评估结果
        if (qualityScore.llmAssessment) {
          console.log('[Plan Agent] 📊 LLM 评估详情:');
          console.log(`  分数: ${qualityScore.llmAssessment.score}/100`);
          console.log(`  通过: ${qualityScore.llmAssessment.passed ? '✅' : '❌'}`);
          console.log(`  优势: ${qualityScore.llmAssessment.strengths.join(', ')}`);
          console.log(`  弱点: ${qualityScore.llmAssessment.weaknesses.join(', ')}`);
          console.log(`  反馈: ${qualityScore.llmAssessment.feedback}`);
        }
        
        if (shouldRegenerate(qualityScore)) {
          const errorParts = [
            `Growth map quality below threshold.`,
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
        
        console.log(`[Plan Agent] ✅ 质量评估通过 (Code: ${qualityScore.overall}/100${qualityScore.llmAssessment ? `, LLM: ${qualityScore.llmAssessment.score}/100` : ''})`);
      }

      return object;
    },
  );
}
