/**
 * 解析用户的修改意图
 * 尝试识别常见的修改模式，如添加、删除、修改等
 */

export type ModificationType = 
  | 'add_stage'
  | 'remove_stage'
  | 'add_goal'
  | 'remove_goal'
  | 'add_task'
  | 'remove_task'
  | 'update_title'
  | 'update_description'
  | 'update_duration'
  | 'reorder'
  | 'complex' // 需要重新生成

export interface ParsedModification {
  type: ModificationType
  target?: {
    stageIndex?: number
    goalIndex?: number
    taskIndex?: number
  }
  newValue?: string | number
  description: string
}

/**
 * 简单的意图识别
 * 在实际应用中，可以使用 LLM 来做更精确的解析
 */
export function parseModificationIntent(modification: string): ParsedModification {
  const lowerMod = modification.toLowerCase()

  // 添加阶段
  if (lowerMod.includes('添加') && (lowerMod.includes('阶段') || lowerMod.includes('stage'))) {
    return {
      type: 'add_stage',
      description: modification,
    }
  }

  // 删除阶段
  if (lowerMod.includes('删除') && (lowerMod.includes('阶段') || lowerMod.includes('stage'))) {
    // 尝试提取阶段索引
    const match = modification.match(/第?\s*(\d+)\s*[个]?阶段/)
    return {
      type: 'remove_stage',
      target: match ? { stageIndex: parseInt(match[1]) - 1 } : undefined,
      description: modification,
    }
  }

  // 添加任务
  if (lowerMod.includes('添加') && (lowerMod.includes('任务') || lowerMod.includes('task'))) {
    return {
      type: 'add_task',
      description: modification,
    }
  }

  // 删除任务
  if (lowerMod.includes('删除') && (lowerMod.includes('任务') || lowerMod.includes('task'))) {
    return {
      type: 'remove_task',
      description: modification,
    }
  }

  // 修改标题
  if (lowerMod.includes('修改') && (lowerMod.includes('标题') || lowerMod.includes('title'))) {
    return {
      type: 'update_title',
      description: modification,
    }
  }

  // 修改时长
  if (lowerMod.includes('缩短') || lowerMod.includes('延长') || lowerMod.includes('时长')) {
    return {
      type: 'update_duration',
      description: modification,
    }
  }

  // 默认为复杂修改，需要重新生成
  return {
    type: 'complex',
    description: modification,
  }
}

/**
 * 判断是否需要重新生成整个地图
 */
export function needsRegeneration(modification: ParsedModification): boolean {
  // 复杂修改、涉及多个操作、或者无法精确定位的修改需要重新生成
  return modification.type === 'complex' || 
         (modification.type === 'remove_stage' && !modification.target?.stageIndex) ||
         (modification.type === 'remove_goal' && !modification.target?.goalIndex) ||
         (modification.type === 'remove_task' && !modification.target?.taskIndex)
}
