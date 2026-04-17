/**
 * AI 模型配置管理
 * 提供分层模型策略和动态参数调整
 */

import { getEnv } from './env-runtime'

export interface ModelConfig {
  model: string
  temperature: number
  maxTokens?: number // undefined 表示不限制
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

/**
 * 预定义的模型配置层级
 */
export const MODEL_TIERS = {
  // 高质量场景：复杂内容、高级主题
  premium: {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 8000, // 足够生成完整的学习资料
    topP: 0.9,
    frequencyPenalty: 0.3,
    presencePenalty: 0.3,
  },
  
  // 标准场景：一般教学内容
  standard: {
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 8000, // 足够生成完整的学习资料
    topP: 0.9,
    frequencyPenalty: 0.2,
    presencePenalty: 0.2,
  },
  
  // 快速场景：简单问答、元数据生成
  fast: {
    model: 'gpt-4o-mini',
    temperature: 0.6,
    maxTokens: 4000, // 保留一定限制，避免元数据生成过长
    topP: 0.85,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
  },
} as const

/**
 * 根据任务类型和难度获取最优温度
 */
export function getOptimalTemperature(params: {
  taskType?: string
  difficulty?: string
  contentType?: 'technical' | 'creative' | 'analytical' | 'general'
}): number {
  const { taskType, difficulty, contentType } = params
  
  // 技术/编程类：需要更准确，降低温度
  if (contentType === 'technical' || taskType === 'learn') {
    if (difficulty === 'advanced') return 0.5
    return 0.6
  }
  
  // 创意/反思类：需要更多样性，提高温度
  if (contentType === 'creative' || taskType === 'reflect') {
    return 0.8
  }
  
  // 分析类：中等温度
  if (contentType === 'analytical' || taskType === 'test') {
    return 0.6
  }
  
  // 默认平衡值
  return 0.7
}

/**
 * 为 Lesson Agent 选择最优模型配置
 */
export function selectLessonModelConfig(params: {
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  includeResearch?: boolean
  includeExercises?: boolean
  taskType?: string
}): ModelConfig {
  const { difficulty, includeResearch, includeExercises } = params
  
  // 环境变量覆盖
  const envModel = getEnv('LESSON_AGENT_MODEL') || getEnv('AI_MODEL')
  
  // 高级内容或需要研究的内容使用 premium 配置
  if (difficulty === 'advanced' || includeResearch) {
    return {
      ...MODEL_TIERS.premium,
      model: envModel || MODEL_TIERS.premium.model,
      temperature: getOptimalTemperature({ difficulty, taskType: params.taskType }),
      maxTokens: undefined, // 不限制，确保完整生成
    }
  }
  
  // 中级内容使用 standard 配置
  if (difficulty === 'intermediate') {
    return {
      ...MODEL_TIERS.standard,
      model: envModel || MODEL_TIERS.standard.model,
      temperature: getOptimalTemperature({ difficulty, taskType: params.taskType }),
      maxTokens: undefined, // 不限制，确保完整生成
    }
  }
  
  // 初级内容也不限制，确保完整性
  return {
    ...MODEL_TIERS.standard,
    model: envModel || MODEL_TIERS.standard.model,
    temperature: getOptimalTemperature({ difficulty, taskType: params.taskType }),
    maxTokens: undefined, // 不限制，确保完整生成
  }
}

/**
 * 为 Advisor Agent 选择最优模型配置
 */
export function selectAdvisorModelConfig(): ModelConfig {
  const envModel = getEnv('ADVISOR_AGENT_MODEL') || getEnv('AI_MODEL')
  
  return {
    ...MODEL_TIERS.premium,
    model: envModel || MODEL_TIERS.premium.model,
    temperature: 0.7,
  }
}

/**
 * 为 Plan Agent 选择最优模型配置
 */
export function selectPlanModelConfig(): ModelConfig {
  const envModel = getEnv('PLAN_AGENT_MODEL') || getEnv('AI_MODEL')
  const actualModel = envModel || MODEL_TIERS.premium.model
  
  // DeepSeek 模型不支持 topP/frequencyPenalty/presencePenalty 参数
  // 传递这些参数会导致 structured output 失败
  const isDeepSeek = actualModel.toLowerCase().includes('deepseek')
  
  if (isDeepSeek) {
    return {
      model: actualModel,
      temperature: 0.7,
      maxTokens: undefined, // 不限制，确保完整的成长地图
    }
  }
  
  return {
    ...MODEL_TIERS.premium,
    model: actualModel,
    temperature: 0.7,
    maxTokens: undefined, // 不限制，确保完整的成长地图
  }
}

/**
 * 为 Schedule Agent 选择最优模型配置
 */
export function selectScheduleModelConfig(): ModelConfig {
  const envModel = getEnv('SCHEDULE_AGENT_MODEL') || getEnv('AI_MODEL')
  const actualModel = envModel || MODEL_TIERS.standard.model
  
  // DeepSeek 模型不支持 topP/frequencyPenalty/presencePenalty 参数
  const isDeepSeek = actualModel.toLowerCase().includes('deepseek')
  
  if (isDeepSeek) {
    return {
      model: actualModel,
      temperature: 0.6,
      maxTokens: 2500,
    }
  }
  
  // Schedule Agent 主要生成元数据，可以使用 fast 配置
  return {
    ...MODEL_TIERS.fast,
    model: actualModel,
    temperature: 0.6,
    maxTokens: 2500,
  }
}

/**
 * 获取模型配置的摘要信息（用于日志）
 */
export function getModelConfigSummary(config: ModelConfig): string {
  return `Model: ${config.model}, Temp: ${config.temperature}, MaxTokens: ${config.maxTokens || 'default'}`
}
