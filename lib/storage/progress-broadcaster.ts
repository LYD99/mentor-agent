/**
 * 进度广播器 - 通过 SSE 实时推送工具执行进度
 */

// 使用全局变量确保单例（避免 Next.js 热重载导致的多实例问题）
const globalForConnections = globalThis as unknown as {
  sseConnections: Map<string, ReadableStreamDefaultController> | undefined
}

// 存储所有活跃的 SSE 连接
const connections = globalForConnections.sseConnections ?? new Map<string, ReadableStreamDefaultController>()
if (!globalForConnections.sseConnections) {
  globalForConnections.sseConnections = connections
}

export const progressBroadcaster = {
  /**
   * 注册 SSE 连接
   */
  registerConnection(toolCallId: string, controller: ReadableStreamDefaultController) {
    connections.set(toolCallId, controller)
  },

  /**
   * 注销 SSE 连接
   */
  unregisterConnection(toolCallId: string) {
    connections.delete(toolCallId)
  },

  /**
   * 推送进度更新
   */
  pushProgress(toolCallId: string, data: {
    type: 'stage_progress' | 'lesson_progress' | 'completed' | 'failed'
    stageProgress?: any[]
    currentStep?: number
    totalSteps?: number
    message?: string
    result?: any
    error?: string
  }) {
    const controller = connections.get(toolCallId)
    if (controller) {
      try {
        const message = JSON.stringify(data)
        controller.enqueue(`data: ${message}\n\n`)
      } catch (error) {
        console.error('[Progress Broadcaster] Failed to push progress:', error)
        connections.delete(toolCallId)
      }
    }
  },

  /**
   * 获取活跃连接数
   */
  getActiveConnections() {
    return connections.size
  },
}
