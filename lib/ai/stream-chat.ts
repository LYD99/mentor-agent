/**
 * Stream Chat - 消息流模式
 * 
 * 核心特性：
 * 1. 增量保存：每个文本片段、工具调用、工具结果立即保存到 JSONL
 * 2. 简化追踪：移除 ToolCallExecution 表，工具信息直接在消息流中
 * 3. 模型自主重试：工具错误返回给 AI，由 AI 决定是否重试
 */

import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { getEnv } from '@/lib/config/env-runtime'
import { truncateForLog } from '@/lib/utils/text-truncate'
import { chatDualWrite } from '@/lib/storage/chat-dual-write'

function truncateToolParamsForLog(params: any): any {
  if (!params || typeof params !== 'object') {
    return params
  }
  
  const truncated = { ...params }
  const fieldsToTruncate = [
    'researchSummary',
    'contextPack', 
    'mapContext',
    'description',
    'content',
  ]
  
  for (const field of fieldsToTruncate) {
    if (truncated[field] && typeof truncated[field] === 'string') {
      truncated[field] = truncateForLog(truncated[field])
    }
  }
  
  return truncated
}

function getOpenAIProvider() {
  const apiKey = getEnv('AI_API_KEY')
  const baseURL = getEnv('AI_BASE_URL')
  
  return createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  })
}

export async function streamChat(params: {
  messages: Array<{ role: string; content: string }>
  systemPrompt?: string
  tools?: any
  userId?: string
  sessionId?: string
  messageId?: string
  responseHeaders?: HeadersInit
  abortSignal?: AbortSignal
  toolContext?: Record<string, any>
}) {
  const { messages, systemPrompt, tools, userId, sessionId, messageId, responseHeaders, abortSignal, toolContext } = params

  const combinedController = new AbortController()
  const combinedSignal = combinedController.signal
  
  if (abortSignal?.aborted) {
    combinedController.abort()
  }
  
  if (abortSignal) {
    abortSignal.addEventListener('abort', () => {
      combinedController.abort()
    })
  }

  const openaiProvider = getOpenAIProvider()
  const apiKey = getEnv('AI_API_KEY')
  
  if (!apiKey?.trim()) {
    throw new Error('Missing AI_API_KEY — the model cannot be called.')
  }

  const allMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  // 包装工具：返回错误而不是抛出异常，让 AI 自主决定是否重试
  const toolsWithErrorHandling = tools && userId
    ? Object.fromEntries(
        Object.entries(tools).map(([name, toolDef]: [string, any]) => {
          const originalExecute = toolDef.execute
          return [
            name,
            {
              ...toolDef,
              execute: async (params: any, options?: { toolCallId?: string }) => {
                const toolCallId = options?.toolCallId || `${name}_${Date.now()}`
                const truncatedParams = truncateToolParamsForLog(params)
                
                console.log(`[Tool ${name}] Started with params:`, JSON.stringify(truncatedParams))
                
                // 工具调用前：异步保存之前累积的文本（不阻塞工具执行）
                if (sessionId && accumulatedText.trim()) {
                  const textToSave = accumulatedText
                  accumulatedText = '' // 立即清空，避免重复保存
                  
                  // 异步保存，不等待完成
                  chatDualWrite.appendMessage({
                    sessionId,
                    message: {
                      role: 'assistant',
                      content: textToSave,
                    },
                    model: getEnv('AI_MODEL'),
                  }).then(() => {
                    console.log(`[Tool ${name}] Saved accumulated text before tool execution`)
                  }).catch((error) => {
                    console.error(`[Tool ${name}] Failed to save accumulated text:`, error)
                  })
                }
                
                if (combinedSignal.aborted) {
                  return {
                    success: false,
                    error: 'Operation aborted by user',
                  }
                }

                const startTime = Date.now()
                
                try {
                  const abortPromise = new Promise<never>((_, reject) => {
                    if (combinedSignal.aborted) {
                      reject(new Error('Operation aborted'))
                      return
                    }
                    combinedSignal.addEventListener('abort', () => {
                      reject(new Error('Operation aborted'))
                    }, { once: true })
                  })
                  
                  const result = await Promise.race([
                    originalExecute({ 
                      ...params, 
                      userId,
                      abortSignal: combinedSignal,
                    }, { 
                      toolCallId,
                      ...toolContext,
                    }),
                    abortPromise
                  ])
                  
                  if (combinedSignal.aborted) {
                    return {
                      success: false,
                      error: 'Operation aborted by user',
                    }
                  }
                  
                  const duration = Date.now() - startTime
                  console.log(`[Tool ${name}] Completed successfully in ${duration}ms`)
                  
                  // 异步保存工具调用消息（tool_calls），带状态
                  if (sessionId) {
                    chatDualWrite.appendMessage({
                      sessionId,
                      message: {
                        role: 'assistant',
                        tool_calls: [{
                          id: toolCallId,
                          type: 'function',
                          function: {
                            name,
                            arguments: JSON.stringify(params),
                          },
                        }],
                      },
                      state: {
                        type: 'tool_call',
                        tool_call_id: toolCallId,
                        tool_name: name,
                        tool_status: 'pending',
                      },
                    }).catch((error) => {
                      console.error('[StreamChat] Failed to save tool_calls message:', error)
                    })
                  }
                  
                  // 异步保存工具结果消息（tool result），带状态和时长
                  if (sessionId) {
                    chatDualWrite.appendMessage({
                      sessionId,
                      message: {
                        role: 'tool',
                        tool_call_id: toolCallId,
                        content: JSON.stringify(result),
                      },
                      state: {
                        type: 'tool_result',
                        tool_call_id: toolCallId,
                        tool_name: name,
                        tool_status: 'success',
                        tool_duration_ms: duration,
                      },
                    }).catch((error) => {
                      console.error('[StreamChat] Failed to save tool result message:', error)
                    })
                  }
                  
                  return result
                } catch (error) {
                  const isCancelled = error instanceof Error && 
                    (error.message === 'Operation aborted by user' || 
                     error.message === 'Operation aborted' || 
                     error.name === 'AbortError' ||
                     error.message.includes('Operation aborted'))
                  
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                  const duration = Date.now() - startTime
                  
                  if (isCancelled) {
                    console.log(`[Tool ${name}] Cancelled by user after ${duration}ms`)
                  } else {
                    console.error(`[Tool ${name}] Failed after ${duration}ms:`, errorMessage)
                  }
                  
                  // 异步保存工具调用消息（失败的），不阻塞返回
                  if (sessionId) {
                    chatDualWrite.appendMessage({
                      sessionId,
                      message: {
                        role: 'assistant',
                        tool_calls: [{
                          id: toolCallId,
                          type: 'function',
                          function: {
                            name,
                            arguments: JSON.stringify(params),
                          },
                        }],
                      },
                    }).catch((saveError) => {
                      console.error('[StreamChat] Failed to save tool_calls message:', saveError)
                    })
                  }
                  
                  // 异步保存工具错误结果，带状态和时长
                  if (sessionId) {
                    chatDualWrite.appendMessage({
                      sessionId,
                      message: {
                        role: 'tool',
                        tool_call_id: toolCallId,
                        content: JSON.stringify({
                          success: false,
                          error: isCancelled ? '用户已中断操作' : errorMessage,
                        }),
                      },
                      state: {
                        type: 'tool_result',
                        tool_call_id: toolCallId,
                        tool_name: name,
                        tool_status: 'error',
                        tool_duration_ms: duration,
                        tool_error: isCancelled ? '用户已中断操作' : errorMessage,
                      },
                    }).catch((saveError) => {
                      console.error('[StreamChat] Failed to save tool error message:', saveError)
                    })
                  }
                  
                  // 返回错误而不是抛出异常，让 AI 自主决定是否重试
                  return {
                    success: false,
                    error: isCancelled ? '用户已中断操作' : errorMessage,
                  }
                }
              },
            },
          ]
        })
      )
    : tools

  // 累积文本，用于保存 assistant 文本消息
  let accumulatedText = ''

  const result = streamText({
    model: openaiProvider(getEnv('AI_MODEL') || 'gpt-4o-mini'),
    messages: allMessages as any,
    tools: toolsWithErrorHandling,
    maxSteps: 5,
    experimental_toolCallStreaming: true,
    abortSignal: combinedSignal,
    onChunk: async ({ chunk }) => {
      // 累积文本
      if (chunk.type === 'text-delta' && sessionId) {
        accumulatedText += chunk.textDelta
      }
      
      // 处理工具调用开始事件
      if (chunk.type === 'tool-call-streaming-start' || chunk.type === 'tool-call') {
        // 如果有累积的文本，先保存（带 state）
        if (sessionId && accumulatedText.trim()) {
          const textToSave = accumulatedText
          accumulatedText = ''
          
          chatDualWrite.appendMessage({
            sessionId,
            message: {
              role: 'assistant',
              content: textToSave,
            },
            state: {
              type: 'text',
            },
            model: getEnv('AI_MODEL'),
          }).catch((error) => {
            console.error('[StreamChat] Failed to save accumulated text before tool call:', error)
          })
        }
      }
    },
    onFinish: async (event) => {
      // 保存最后剩余的文本（带 state）
      if (sessionId && accumulatedText.trim()) {
        try {
          await chatDualWrite.appendMessage({
            sessionId,
            message: {
              role: 'assistant',
              content: accumulatedText,
            },
            state: {
              type: 'text',
            },
            usage: event.usage,
            model: getEnv('AI_MODEL'),
          })
        } catch (error) {
          console.error('[StreamChat] Failed to save final text:', error)
        }
      }
    },
  })

  result.consumeStream().catch(async (error) => {
    // 中断时：保存已累积的文本（带 state）
    if (sessionId && accumulatedText.trim()) {
      try {
        await chatDualWrite.appendMessage({
          sessionId,
          message: {
            role: 'assistant',
            content: accumulatedText,
          },
          state: {
            type: 'text',
          },
          model: getEnv('AI_MODEL'),
        })
        console.log('[StreamChat] Saved accumulated text on abort/error')
      } catch (saveError) {
        console.error('[StreamChat] Failed to save accumulated text on abort:', saveError)
      }
    }
    
    if (!combinedSignal.aborted) {
      combinedController.abort()
    }
  })

  return result.toDataStreamResponse({
    headers: responseHeaders,
    getErrorMessage: (err) =>
      err instanceof Error ? err.message : 'Model request failed',
  })
}
