/**
 * Agent 重试机制
 * 封装了完整的重试逻辑，包括：
 * - 自动重试（带指数退避）
 * - 错误反馈给 LLM
 * - 中断检测
 * - 统一日志
 */

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AgentRetryOptions<T> {
  agentName: string;
  operation: string;
  paramsPreview?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  abortSignal?: AbortSignal;
  onError?: (error: Error, attempt: number) => void | Promise<void>;
  buildPrompt?: (previousError?: string) => string | Promise<string>;
}

/**
 * Agent 重试包装器
 * 
 * @example
 * const result = await withAgentRetry({
 *   agentName: 'Plan Agent',
 *   operation: 'generate growth map',
 *   maxRetries: 3,
 *   abortSignal: signal,
 *   buildPrompt: (previousError) => {
 *     let prompt = 'Generate a map...'
 *     if (previousError) {
 *       prompt += `\n\n⚠️ Previous attempt failed: ${previousError}`
 *     }
 *     return prompt
 *   }
 * }, async (prompt) => {
 *   // 执行实际的 LLM 调用
 *   return await generateObject({ prompt, ... })
 * })
 */
export async function withAgentRetry<T>(
  options: AgentRetryOptions<T>,
  fn: (prompt: string, attempt: number) => Promise<T>,
): Promise<T> {
  const {
    agentName,
    operation,
    paramsPreview,
    maxRetries = 3,
    retryDelayMs = 1000,
    abortSignal,
    onError,
    buildPrompt,
  } = options;

  let lastError: Error | null = null;
  let previousAttemptError: string | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 检查是否已中断
      if (abortSignal?.aborted) {
        throw new Error("Operation aborted by user");
      }

      // 记录日志
      if (attempt > 1) {
        console.log(
          `[${agentName}] Retry attempt ${attempt}/${maxRetries} for ${operation}${paramsPreview ? `: ${paramsPreview}` : ""}`,
        );
      } else {
        console.log(
          `[${agentName}] Attempt ${attempt}/${maxRetries} for ${operation}${paramsPreview ? `: ${paramsPreview}` : ""}`,
        );
      }

      // 构建提示词（如果提供了 buildPrompt）
      const prompt = buildPrompt
        ? await buildPrompt(previousAttemptError || undefined)
        : "";

      // 执行实际操作
      const result = await fn(prompt, attempt);

      // 成功 - 记录日志并返回
      console.log(`[${agentName}] Successfully completed ${operation}`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      previousAttemptError = lastError.message;

      // 检查是否为用户中断错误
      const isAborted =
        lastError.message.includes("Operation aborted") ||
        lastError.name === "AbortError";

      console.error(
        `[${agentName}] Attempt ${attempt} failed for ${operation}${paramsPreview ? ` (${paramsPreview})` : ""}:`,
        lastError.message,
      );

      // 如果是用户中断，立即停止重试
      if (isAborted) {
        console.log(`[${agentName}] User aborted, stopping retries`);
        throw lastError;
      }

      // 调用错误回调（如果提供）
      if (onError) {
        await onError(lastError, attempt);
      }

      // 如果还有重试机会，等待后重试
      if (attempt < maxRetries) {
        const delay = retryDelayMs * attempt; // 指数退避
        await sleep(delay);
      }
    }
  }

  // 所有重试都失败了
  const failureMessage = paramsPreview
    ? `Failed to ${operation} (${paramsPreview}) after ${maxRetries} attempts. Last error: ${lastError?.message}`
    : `Failed to ${operation} after ${maxRetries} attempts. Last error: ${lastError?.message}`;
  
  console.error(`[${agentName}] ${failureMessage}`);
  throw new Error(failureMessage);
}
