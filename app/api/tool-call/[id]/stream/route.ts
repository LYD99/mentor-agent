import { NextRequest } from 'next/server'
import { progressBroadcaster } from '@/lib/storage/progress-broadcaster'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: toolCallId } = await params

  // 创建 SSE 流
  const stream = new ReadableStream({
    start(controller) {
      // 注册连接
      progressBroadcaster.registerConnection(toolCallId, controller)
      
      // 发送初始连接消息
      const data = JSON.stringify({ type: 'connected', toolCallId })
      controller.enqueue(`data: ${data}\n\n`)
      
      // 心跳检测，每 30 秒发送一次
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: heartbeat\n\n`)
        } catch (error) {
          clearInterval(heartbeat)
        }
      }, 30000)
      
      // 清理函数
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        progressBroadcaster.unregisterConnection(toolCallId)
        try {
          controller.close()
        } catch (e) {
          // 连接可能已关闭
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
