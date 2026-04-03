import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { GrowthMapSchema, type GrowthMapData } from "./plan-schema";
import { getEnv } from "@/lib/config/env-runtime";
import { withAgentRetry } from "./agent-retry";
import { truncateForLog } from "@/lib/utils/text-truncate";

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
      const { object } = await generateObject({
        model: openaiProvider(getEnv("AI_MODEL") || "gpt-4o-mini"),
        schema: GrowthMapSchema,
        prompt,
        temperature: 0.7,
        abortSignal: params.abortSignal,
      });

      // Validate the generated object
      if (!validateGrowthMap(object)) {
        throw new Error("Generated map does not match required structure");
      }

      return object;
    },
  );
}
