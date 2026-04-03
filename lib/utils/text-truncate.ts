/**
 * 文本截断工具函数
 * 用于在 UI 展示和日志中显示简短的文本预览
 */

export interface TruncateOptions {
  maxLength?: number;
  ellipsis?: string;
  breakWords?: boolean;
}

/**
 * 截断文本到指定长度
 * 
 * @param text - 要截断的文本
 * @param maxLength - 最大长度（默认 100）
 * @param ellipsis - 省略符号（默认 "..."）
 * @param breakWords - 是否在单词中间截断（默认 false，会尝试在空格处截断）
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number = 100,
  ellipsis: string = '...',
  breakWords: boolean = false
): string {
  if (!text) return '';
  
  // 如果文本长度小于等于最大长度，直接返回
  if (text.length <= maxLength) {
    return text;
  }
  
  // 计算实际截断位置（需要为省略符号留空间）
  const truncateAt = maxLength - ellipsis.length;
  
  if (breakWords) {
    // 直接在指定位置截断
    return text.substring(0, truncateAt) + ellipsis;
  }
  
  // 尝试在空格处截断，避免截断单词
  const truncated = text.substring(0, truncateAt);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  // 如果找到空格且不是太靠前（至少保留 50% 的内容）
  if (lastSpaceIndex > truncateAt * 0.5) {
    return truncated.substring(0, lastSpaceIndex) + ellipsis;
  }
  
  // 否则直接截断
  return truncated + ellipsis;
}

/**
 * 为日志输出截断文本（更短）
 */
export function truncateForLog(text: string | null | undefined): string {
  return truncateText(text, 80, '...');
}

/**
 * 为 UI 展示截断文本（稍长）
 */
export function truncateForUI(text: string | null | undefined): string {
  return truncateText(text, 150, '...');
}

/**
 * 截断多行文本，保留前几行
 */
export function truncateLines(
  text: string | null | undefined,
  maxLines: number = 3,
  ellipsis: string = '...'
): string {
  if (!text) return '';
  
  const lines = text.split('\n');
  
  if (lines.length <= maxLines) {
    return text;
  }
  
  return lines.slice(0, maxLines).join('\n') + '\n' + ellipsis;
}

/**
 * 智能截断：优先按行截断，如果单行过长则按字符截断
 */
export function smartTruncate(
  text: string | null | undefined,
  maxLength: number = 150,
  maxLines: number = 3
): string {
  if (!text) return '';
  
  // 先按行截断
  const linesTruncated = truncateLines(text, maxLines, '');
  
  // 如果截断后的文本仍然过长，再按字符截断
  if (linesTruncated.length > maxLength) {
    return truncateText(linesTruncated, maxLength);
  }
  
  // 如果原文本比截断后的长，添加省略符号
  if (text.length > linesTruncated.length) {
    return linesTruncated + '\n...';
  }
  
  return linesTruncated;
}
