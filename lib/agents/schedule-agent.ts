import { generateObject, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getEnv } from "@/lib/config/env-runtime";
import { prisma } from "@/lib/db";
import { withAgentRetry } from "./agent-retry";
import { buildBatchSchedulePrompt, buildBatchScheduleErrorPrompt } from "@/lib/prompts/schedule-prompts";
import { selectScheduleModelConfig, getModelConfigSummary } from "@/lib/config/model-config";
import { 
  assessScheduleQualityComprehensive, 
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

/**
 * 并发控制：限制同时执行的 Promise 数量
 * @param tasks 任务函数数组
 * @param limit 并发限制数量
 * @returns Promise.allSettled 的结果
 */
async function pLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let currentIndex = 0;

  async function executeNext(): Promise<void> {
    const index = currentIndex++;
    if (index >= tasks.length) return;

    try {
      const result = await tasks[index]();
      results[index] = { status: 'fulfilled', value: result };
    } catch (error) {
      results[index] = { status: 'rejected', reason: error };
    }

    // 递归执行下一个任务
    await executeNext();
  }

  // 启动初始的并发任务
  const workers = Array(Math.min(limit, tasks.length))
    .fill(null)
    .map(() => executeNext());

  await Promise.all(workers);
  return results;
}

// 单日学习计划 Schema（元数据模式 - Scheme D）
// 只包含元数据，详细内容由 Lesson Agent 在执行时生成
const DailyScheduleItemSchema = z.object({
  date: z.string().describe("Date in YYYY-MM-DD format"),
  dayOfWeek: z.number().describe("Day of week (0=Sunday, 6=Saturday)"),
  tasks: z.array(
    z.object({
      taskId: z.string().describe("ID of the growth task"),
      taskTitle: z.string().describe("Title of the task"),
      // 元数据字段（轻量级）
      learningObjectives: z
        .array(z.string())
        .describe("Key learning objectives for this day (2-4 items)"),
      difficulty: z
        .enum(["beginner", "intermediate", "advanced"])
        .describe("Difficulty level of today's content"),
      suggestedDuration: z
        .string()
        .describe("Suggested time allocation (e.g., '1-2 hours', '30-60 minutes')"),
      prerequisites: z
        .array(z.string())
        .optional()
        .describe("Prerequisites or prior knowledge needed"),
      focusAreas: z
        .array(z.string())
        .describe("Main topics or skills to focus on (2-3 items)"),
    }),
  ),
});

// 分批学习计划 Schema（用于分批生成）
const BatchScheduleSchema = z.object({
  dailySchedule: z.array(DailyScheduleItemSchema),
});

// 完整学习计划 Schema
const GrowthScheduleSchema = z.object({
  dailySchedule: z.array(DailyScheduleItemSchema),
  scheduledTasks: z.array(
    z.object({
      taskType: z.enum([
        "daily_study_reminder",
        "daily_report_reminder",
        "daily_auto_summary",
        "weekly_report",
        "monthly_report",
      ]),
      cronExpression: z.string().describe("Cron expression for scheduling"),
      content: z.object({
        title: z.string(),
        description: z.string(),
        actionType: z.string().optional(),
        params: z.record(z.any()).optional(),
      }),
    }),
  ),
});

type GrowthScheduleData = z.infer<typeof GrowthScheduleSchema>;
type DailyScheduleItem = z.infer<typeof DailyScheduleItemSchema>;

interface SchedulePreferences {
  studyReminderTime: string; // HH:mm
  reportReminderTime: string; // HH:mm
  summaryTime: string; // HH:mm
  weeklyReportDay: number; // 0-6
  monthlyReportDay: number; // 1-28
  timezone: string;
}

/**
 * 将 HH:mm 格式的时间转换为 cron 表达式
 */
function timeToCron(time: string): { minute: string; hour: string } {
  const [hour, minute] = time.split(":");
  return { minute, hour };
}

/**
 * 生成成长地图的学习计划和定时任务（内部实现，不包含质量验证）
 */
type StageProgressCallback = (stage: {
  stageIndex: number;
  stageTitle: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalStages: number;
}) => void | Promise<void>;

async function generateGrowthScheduleInternal(params: {
  mapId: string;
  mapContext: string;
  preferences: SchedulePreferences;
  abortSignal?: AbortSignal;
  onStageProgress?: StageProgressCallback;
}): Promise<{ dailySchedule: DailyScheduleItem[] }> {
  const apiKey = getEnv("AI_API_KEY");
  if (!apiKey?.trim()) {
    throw new Error("Missing AI_API_KEY");
  }

  console.log(`[Schedule Agent] Starting generate growth schedule for mapId: ${params.mapId}`);
  const startTime = Date.now();

      // 获取地图详细信息（v2.5: 移除 goals）
      const map = await prisma.growthMap.findUnique({
        where: { id: params.mapId },
        include: {
          stages: {
            orderBy: { stageOrder: "asc" },
            include: {
              tasks: {
                orderBy: { taskOrder: "asc" },
              },
            },
          },
        },
      });

      if (!map) {
        throw new Error("Growth map not found");
      }

      // 按阶段组织任务和批次（v2.5: 移除 goalTitle）
      interface StageBatch {
        stageIndex: number;
        stageTitle: string;
        batchIndex: number; // 阶段内的批次索引
        totalBatchesInStage: number; // 该阶段的总批次数
        startDay: number;
        endDay: number;
        tasks: Array<{
          id: string;
          title: string;
          description: string;
          type: string;
          durationDays: number;
          stageTitle: string;
        }>;
      }

      // 每批最多生成的天数（方案 2 优化）
      const MAX_DAYS_PER_BATCH = 30;

      const stageBatches: StageBatch[] = [];
      let currentDay = 0;

      for (let stageIdx = 0; stageIdx < map.stages.length; stageIdx++) {
        const stage = map.stages[stageIdx];
        const stageTasks: StageBatch['tasks'] = [];
        let stageDays = 0;

        // v2.5: 直接遍历 stage.tasks
        for (const task of stage.tasks) {
          stageTasks.push({
            id: task.id,
            title: task.title,
            description: task.description || "",
            type: task.type,
            durationDays: task.durationDays || 1,
            stageTitle: stage.title,
          });
          stageDays += task.durationDays || 1;
        }

        // 将阶段进一步细分为小批次（每批最多 30 天）
        const numBatches = Math.ceil(stageDays / MAX_DAYS_PER_BATCH);
        
        for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
          const batchStartDay = currentDay + (batchIdx * MAX_DAYS_PER_BATCH);
          const batchEndDay = Math.min(
            batchStartDay + MAX_DAYS_PER_BATCH,
            currentDay + stageDays
          );
          const batchDays = batchEndDay - batchStartDay;

          stageBatches.push({
            stageIndex: stageIdx,
            stageTitle: stage.title,
            batchIndex: batchIdx,
            totalBatchesInStage: numBatches,
            startDay: batchStartDay,
            endDay: batchEndDay,
            tasks: stageTasks, // 所有任务都传递，但只生成该批次的天数
          });
        }

        currentDay += stageDays;
      }

      const totalDays = currentDay;

      try {
        console.log("[Schedule Agent] Generating learning schedule...");
        console.log(`[Schedule Agent] Total batches: ${stageBatches.length}, Total days: ${totalDays}`);
        
        // 统计每个阶段的信息
        const stageInfo = new Map<number, { title: string; totalBatches: number }>();
        for (const batch of stageBatches) {
          if (!stageInfo.has(batch.stageIndex)) {
            stageInfo.set(batch.stageIndex, {
              title: batch.stageTitle,
              totalBatches: batch.totalBatchesInStage,
            });
          }
        }
        
        console.log(`[Schedule Agent] Stages breakdown:`);
        stageInfo.forEach((info, idx) => {
          console.log(`  Stage ${idx + 1}: "${info.title}" - ${info.totalBatches} batches`);
        });

        // 先报告所有阶段为 pending 状态
        if (params.onStageProgress) {
          for (const [stageIndex, info] of stageInfo) {
            await params.onStageProgress({
              stageIndex,
              stageTitle: info.title,
              status: 'pending',
              totalStages: stageInfo.size,
            });
          }
        }

        const openaiProvider = getOpenAIProvider();
        
        // 选择最优模型配置
        const modelConfig = selectScheduleModelConfig();
        console.log(`[Schedule Agent] Using config: ${getModelConfigSummary(modelConfig)}`);
        const model = openaiProvider(modelConfig.model);

        // 并行生成所有阶段（使用并发控制，限制同时执行的批次数量）
        const allDailySchedules: DailyScheduleItem[] = [];
        
        // 从环境变量读取并发限制，默认 5 个
        const concurrencyLimit = parseInt(getEnv('SCHEDULE_BATCH_CONCURRENCY') || '5', 10);
        console.log(`[Schedule Agent] Using concurrency limit: ${concurrencyLimit} batches`);

        const batchResults = await pLimit(
          stageBatches.map((stageBatch) => async () => {
            // 报告批次开始（只在第一个批次时报告阶段开始）
            if (params.onStageProgress && stageBatch.batchIndex === 0) {
              await params.onStageProgress({
                stageIndex: stageBatch.stageIndex,
                stageTitle: stageBatch.stageTitle,
                status: 'running',
                totalStages: stageInfo.size,
              });
            }

            const batchDays = stageBatch.endDay - stageBatch.startDay;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + stageBatch.startDay);

            const batchPrompt = buildBatchSchedulePrompt({
              stageIndex: stageBatch.stageIndex,
              stageTitle: stageBatch.stageTitle,
              batchIndex: stageBatch.batchIndex,
              totalBatchesInStage: stageBatch.totalBatchesInStage,
              startDay: stageBatch.startDay,
              endDay: stageBatch.endDay,
              batchDays,
              startDate: startDate.toISOString().split("T")[0],
              mapContext: params.mapContext,
              tasks: stageBatch.tasks,
            });

            const result = await withAgentRetry(
              {
                agentName: "Schedule Agent",
                operation: `generate stage ${stageBatch.stageIndex + 1} batch ${stageBatch.batchIndex + 1}/${stageBatch.totalBatchesInStage}`,
                paramsPreview: `"${stageBatch.stageTitle}" (days ${stageBatch.startDay + 1}-${stageBatch.endDay}, ${batchDays} days)`,
                maxRetries: 3,
                retryDelayMs: 1000,
                abortSignal: params.abortSignal,
                buildPrompt: (previousError) => {
                  let prompt = batchPrompt;
                  if (previousError) {
                    prompt += buildBatchScheduleErrorPrompt(previousError);
                  }
                  return prompt;
                },
              },
              async (prompt) => {
                // 方案 1：直接使用 generateObject（更快、更可靠）
                // 构建 generateObject 参数，只在有值时才传递（避免传递 undefined）
                const generateParams: any = {
                  model,
                  schema: BatchScheduleSchema,
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

                // 验证并返回结果（generateObject 已经保证了基本格式）
                const validated = BatchScheduleSchema.safeParse(object);
                if (!validated.success) {
                  console.error(
                    `[Schedule Agent] Stage ${stageBatch.stageIndex + 1} Batch ${stageBatch.batchIndex + 1} validation failed:`,
                    validated.error.errors
                  );
                  throw new Error(
                    `Batch validation failed: ${validated.error.errors
                      .map(e => `${e.path.join('.')}: ${e.message}`)
                      .join('; ')}`
                  );
                }
                return validated.data;
              },
            );

            return result.dailySchedule;
          }),
          concurrencyLimit
        );

        // 处理批次结果，按阶段分组统计
        const stageResults = new Map<number, {
          title: string;
          batches: { success: number; failed: number; totalDays: number };
        }>();
        
        for (let idx = 0; idx < batchResults.length; idx++) {
          const result = batchResults[idx];
          const stageBatch = stageBatches[idx];
          
          // 初始化阶段统计
          if (!stageResults.has(stageBatch.stageIndex)) {
            stageResults.set(stageBatch.stageIndex, {
              title: stageBatch.stageTitle,
              batches: { success: 0, failed: 0, totalDays: 0 },
            });
          }
          
          const stageResult = stageResults.get(stageBatch.stageIndex)!;
          
          if (result.status === 'fulfilled') {
            allDailySchedules.push(...result.value);
            stageResult.batches.success++;
            stageResult.batches.totalDays += result.value.length;
            console.log(
              `[Schedule Agent] Stage ${stageBatch.stageIndex + 1} Batch ${stageBatch.batchIndex + 1}/${stageBatch.totalBatchesInStage} completed: ${result.value.length} days`
            );
            
            // 只在该阶段的最后一个批次完成时报告阶段完成
            if (stageBatch.batchIndex === stageBatch.totalBatchesInStage - 1) {
              const allBatchesSuccess = stageResult.batches.success === stageBatch.totalBatchesInStage;
              
              if (params.onStageProgress) {
                await params.onStageProgress({
                  stageIndex: stageBatch.stageIndex,
                  stageTitle: stageBatch.stageTitle,
                  status: allBatchesSuccess ? 'completed' : 'failed',
                  totalStages: stageInfo.size,
                });
              }
              
              console.log(
                `[Schedule Agent] Stage ${stageBatch.stageIndex + 1} "${stageBatch.stageTitle}" finished: ${stageResult.batches.success}/${stageBatch.totalBatchesInStage} batches succeeded, ${stageResult.batches.totalDays} days generated`
              );
            }
          } else {
            stageResult.batches.failed++;
            console.error(
              `[Schedule Agent] Stage ${stageBatch.stageIndex + 1} Batch ${stageBatch.batchIndex + 1}/${stageBatch.totalBatchesInStage} failed:`,
              result.reason
            );
            
            // 只在该阶段的最后一个批次时报告失败
            if (stageBatch.batchIndex === stageBatch.totalBatchesInStage - 1 && params.onStageProgress) {
              await params.onStageProgress({
                stageIndex: stageBatch.stageIndex,
                stageTitle: stageBatch.stageTitle,
                status: 'failed',
                totalStages: stageInfo.size,
              });
            }
          }
        }

        // 统计失败的阶段
        const failedStages: string[] = [];
        stageResults.forEach((result, stageIndex) => {
          if (result.batches.failed > 0) {
            failedStages.push(
              `Stage ${stageIndex + 1} "${result.title}": ${result.batches.failed} batches failed`
            );
          }
        });

        // 如果所有批次都失败了，抛出错误
        if (allDailySchedules.length === 0) {
          throw new Error(`All batches failed:\n${failedStages.join('\n')}`);
        }

        // 如果有部分批次失败，记录警告但继续
        if (failedStages.length > 0) {
          console.warn(
            `[Schedule Agent] Some batches failed, continuing with ${allDailySchedules.length} days from successful batches:\n${failedStages.join('\n')}`
          );
        }

        // 按日期排序
        allDailySchedules.sort((a, b) => a.date.localeCompare(b.date));

        const successfulBatches = batchResults.filter(r => r.status === 'fulfilled').length;
        console.log(
          `[Schedule Agent] Schedule generation completed: ${allDailySchedules.length} days from ${successfulBatches}/${stageBatches.length} batches (${stageInfo.size} stages)`,
        );

        const duration = Date.now() - startTime;
        console.log(`[Schedule Agent] Completed generate growth schedule successfully in ${duration}ms`);

        return { dailySchedule: allDailySchedules };
  } catch (error) {
    const duration = Date.now() - startTime;
    const isAborted = error instanceof Error && 
      (error.message.includes("Operation aborted") || error.name === "AbortError");
    
    if (isAborted) {
      console.log(`[Schedule Agent] Cancelled generate growth schedule by user after ${duration}ms`);
    } else {
      console.error(`[Schedule Agent] Failed generate growth schedule after ${duration}ms:`, 
        error instanceof Error ? error.message : "Unknown error");
    }
    
    throw new Error(
      `Failed to generate growth schedule: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * 生成成长地图的学习计划和定时任务（带质量验证和重试）
 */
export async function generateGrowthSchedule(params: {
  mapId: string;
  mapContext: string;
  preferences: SchedulePreferences;
  abortSignal?: AbortSignal;
  onStageProgress?: StageProgressCallback;
}): Promise<GrowthScheduleData> {
  // 如果质量验证未启用，直接调用内部实现并添加定时任务
  if (!isQualityValidationEnabled()) {
    const result = await generateGrowthScheduleInternal(params);
    
    // 生成定时任务的 cron 表达式
    const studyTime = timeToCron(params.preferences.studyReminderTime);
    const reportTime = timeToCron(params.preferences.reportReminderTime);
    const summaryTime = timeToCron(params.preferences.summaryTime);

    const scheduledTasks = [
      {
        taskType: "daily_study_reminder" as const,
        cronExpression: `${studyTime.minute} ${studyTime.hour} * * *`,
        content: {
          title: "每日学习提醒",
          description: `每天 ${params.preferences.studyReminderTime} 提醒学习，生成学习资料和练习题`,
          actionType: "generate_daily_lesson",
          params: {
            mapId: params.mapId,
            includeExercises: true,
            includeAnswers: true,
          },
        },
      },
      {
        taskType: "daily_report_reminder" as const,
        cronExpression: `${reportTime.minute} ${reportTime.hour} * * *`,
        content: {
          title: "每日日报提醒",
          description: `每天 ${params.preferences.reportReminderTime} 提醒写学习日报`,
          actionType: "send_report_reminder",
          params: {
            mapId: params.mapId,
            reportType: "daily",
          },
        },
      },
      {
        taskType: "daily_auto_summary" as const,
        cronExpression: `${summaryTime.minute} ${summaryTime.hour} * * *`,
        content: {
          title: "每日自动总结",
          description: `每天 ${params.preferences.summaryTime} 自动总结学习进度`,
          actionType: "generate_daily_summary",
          params: {
            mapId: params.mapId,
            analyzeProgress: true,
          },
        },
      },
      {
        taskType: "weekly_report" as const,
        cronExpression: `0 8 * * ${params.preferences.weeklyReportDay}`,
        content: {
          title: "每周学习周报",
          description: `每周${["日", "一", "二", "三", "四", "五", "六"][params.preferences.weeklyReportDay]}生成学习周报`,
          actionType: "generate_weekly_report",
          params: {
            mapId: params.mapId,
          },
        },
      },
      {
        taskType: "monthly_report" as const,
        cronExpression: `0 8 ${params.preferences.monthlyReportDay} * *`,
        content: {
          title: "每月学习月报",
          description: `每月 ${params.preferences.monthlyReportDay} 号生成学习月报`,
          actionType: "generate_monthly_report",
          params: {
            mapId: params.mapId,
          },
        },
      },
    ];

    return {
      dailySchedule: result.dailySchedule,
      scheduledTasks,
    };
  }

  // 使用 withAgentRetry 包装，支持质量验证和重试
  const resultWithQuality = await withAgentRetry(
    {
      agentName: "Schedule Agent",
      operation: "generate growth schedule with quality validation",
      paramsPreview: `mapId: ${params.mapId}`,
      maxRetries: 3,
      retryDelayMs: 2000,
      abortSignal: params.abortSignal,
      buildPrompt: (previousError) => {
        // 这里不需要返回 prompt，因为内部实现不依赖单一 prompt
        return previousError || "";
      },
    },
    async (errorFeedback, attempt) => {
      // 如果是重试，在进度回调中提示
      if (attempt > 1 && params.onStageProgress) {
        console.log(`[Schedule Agent] 正在重试生成学习计划 (第 ${attempt} 次尝试)...`);
      }

      // 执行内部生成
      const result = await generateGrowthScheduleInternal(params);

      // 质量验证（在 withAgentRetry 回调内部执行）
      console.log('[Schedule Agent] 🔍 开始质量评估（代码 + LLM 双重验证）...');
      
      const qualityScore = await assessScheduleQualityComprehensive(
        result,
        params.mapContext,
        params.abortSignal
      );
      
      const qualityReport = generateQualityReport(qualityScore);
      console.log(qualityReport);
      
      // 记录详细的 LLM 评估结果
      if (qualityScore.llmAssessment) {
        console.log('[Schedule Agent] 📊 LLM 评估详情:');
        console.log(`  分数: ${qualityScore.llmAssessment.score}/100`);
        console.log(`  通过: ${qualityScore.llmAssessment.passed ? '✅' : '❌'}`);
        console.log(`  优势: ${qualityScore.llmAssessment.strengths.join(', ')}`);
        console.log(`  弱点: ${qualityScore.llmAssessment.weaknesses.join(', ')}`);
        console.log(`  反馈: ${qualityScore.llmAssessment.feedback}`);
      }
      
      if (shouldRegenerate(qualityScore)) {
        const errorParts = [
          `Schedule quality below threshold.`,
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
      
      console.log(`[Schedule Agent] ✅ 质量评估通过 (Code: ${qualityScore.overall}/100${qualityScore.llmAssessment ? `, LLM: ${qualityScore.llmAssessment.score}/100` : ''})`);
      
      return result;
    }
  );

  // 生成定时任务的 cron 表达式
  const studyTime = timeToCron(params.preferences.studyReminderTime);
  const reportTime = timeToCron(params.preferences.reportReminderTime);
  const summaryTime = timeToCron(params.preferences.summaryTime);

  const scheduledTasks = [
    {
      taskType: "daily_study_reminder" as const,
      cronExpression: `${studyTime.minute} ${studyTime.hour} * * *`,
      content: {
        title: "每日学习提醒",
        description: `每天 ${params.preferences.studyReminderTime} 提醒学习，生成学习资料和练习题`,
        actionType: "generate_daily_lesson",
        params: {
          mapId: params.mapId,
          includeExercises: true,
          includeAnswers: true,
        },
      },
    },
    {
      taskType: "daily_report_reminder" as const,
      cronExpression: `${reportTime.minute} ${reportTime.hour} * * *`,
      content: {
        title: "每日日报提醒",
        description: `每天 ${params.preferences.reportReminderTime} 提醒写学习日报`,
        actionType: "send_report_reminder",
        params: {
          mapId: params.mapId,
          reportType: "daily",
        },
      },
    },
    {
      taskType: "daily_auto_summary" as const,
      cronExpression: `${summaryTime.minute} ${summaryTime.hour} * * *`,
      content: {
        title: "每日自动总结",
        description: `每天 ${params.preferences.summaryTime} 自动总结学习进度`,
        actionType: "generate_daily_summary",
        params: {
          mapId: params.mapId,
          analyzeProgress: true,
        },
      },
    },
    {
      taskType: "weekly_report" as const,
      cronExpression: `0 8 * * ${params.preferences.weeklyReportDay}`,
      content: {
        title: "每周学习周报",
        description: `每周${["日", "一", "二", "三", "四", "五", "六"][params.preferences.weeklyReportDay]}生成学习周报`,
        actionType: "generate_weekly_report",
        params: {
          mapId: params.mapId,
        },
      },
    },
    {
      taskType: "monthly_report" as const,
      cronExpression: `0 8 ${params.preferences.monthlyReportDay} * *`,
      content: {
        title: "每月学习月报",
        description: `每月 ${params.preferences.monthlyReportDay} 号生成学习月报`,
        actionType: "generate_monthly_report",
        params: {
          mapId: params.mapId,
        },
      },
    },
  ];

  return {
    dailySchedule: resultWithQuality.dailySchedule,
    scheduledTasks,
  };
}
