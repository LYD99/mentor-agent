/**
 * 文件处理服务
 * 支持 Markdown、TXT、PDF 等格式的文件解析
 */

export interface ProcessedFile {
  title: string
  contentMarkdown: string
  tags?: string[]
  metadata?: Record<string, any>
}

export interface FileMetadata {
  wordCount?: number
  language?: string
  hasCodeBlocks?: boolean
  estimatedReadingTime?: number // 分钟
}

export class FileProcessor {
  /**
   * 处理文件（根据类型自动选择处理器）
   */
  static async processFile(
    file: File,
    options?: { extractMetadata?: boolean }
  ): Promise<ProcessedFile> {
    const filename = file.name
    const extension = filename.split('.').pop()?.toLowerCase()

    switch (extension) {
      case 'md':
      case 'markdown':
        return this.processMarkdown(file, options)
      case 'txt':
        return this.processText(file, options)
      case 'pdf':
        return this.processPDF(file, options)
      default:
        throw new Error(`Unsupported file type: ${extension}`)
    }
  }

  /**
   * 处理 Markdown 文件
   */
  static async processMarkdown(
    file: File,
    options?: { extractMetadata?: boolean }
  ): Promise<ProcessedFile> {
    const content = await file.text()
    const title = this.generateTitle(file.name, content)
    const tags = this.extractTags(content)
    const metadata = options?.extractMetadata
      ? this.extractMetadata(content)
      : undefined

    return {
      title,
      contentMarkdown: content,
      tags,
      metadata,
    }
  }

  /**
   * 处理纯文本文件
   */
  static async processText(
    file: File,
    options?: { extractMetadata?: boolean }
  ): Promise<ProcessedFile> {
    const content = await file.text()
    const title = this.generateTitle(file.name, content)
    const tags = this.extractTags(content)
    
    // 将纯文本转换为 Markdown（添加标题和代码块格式）
    const contentMarkdown = `# ${title}\n\n${content}`
    
    const metadata = options?.extractMetadata
      ? this.extractMetadata(content)
      : undefined

    return {
      title,
      contentMarkdown,
      tags,
      metadata,
    }
  }

  /**
   * 处理 PDF 文件
   */
  static async processPDF(
    file: File,
    options?: { extractMetadata?: boolean }
  ): Promise<ProcessedFile> {
    try {
      // 动态导入 pdf-parse 以避免 webpack 打包问题
      const pdfParse = (await import('pdf-parse')).default
      
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const data = await pdfParse(buffer)

      const title = this.generateTitle(file.name, data.text)
      const tags = this.extractTags(data.text)
      
      // 将 PDF 文本转换为 Markdown 格式
      const contentMarkdown = this.convertPDFToMarkdown(
        title,
        data.text,
        data.info
      )
      
      const metadata = options?.extractMetadata
        ? {
            ...this.extractMetadata(data.text),
            pdfInfo: {
              pages: data.numpages,
              author: data.info?.Author,
              title: data.info?.Title,
              subject: data.info?.Subject,
            },
          }
        : undefined

      return {
        title,
        contentMarkdown,
        tags,
        metadata,
      }
    } catch (error) {
      console.error('Failed to process PDF:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }

  /**
   * 从 PDF 文本生成 Markdown
   */
  private static convertPDFToMarkdown(
    title: string,
    text: string,
    info?: any
  ): string {
    const sections: string[] = []

    sections.push(`# ${title}`)

    // 添加 PDF 元信息
    if (info) {
      const metaInfo: string[] = []
      if (info.Author) metaInfo.push(`**作者**: ${info.Author}`)
      if (info.Subject) metaInfo.push(`**主题**: ${info.Subject}`)
      if (info.CreationDate)
        metaInfo.push(`**创建日期**: ${info.CreationDate}`)

      if (metaInfo.length > 0) {
        sections.push(`> ${metaInfo.join(' | ')}`)
      }
    }

    // 清理和格式化文本
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // 移除多余空行
      .trim()

    sections.push(`## 内容\n\n${cleanedText}`)
    sections.push(
      `---\n*从 PDF 文件导入: ${new Date().toLocaleString('zh-CN')}*`
    )

    return sections.join('\n\n')
  }

  /**
   * 提取文件元数据
   */
  static extractMetadata(content: string): FileMetadata {
    const wordCount = content.split(/\s+/).length
    const hasCodeBlocks = /```[\s\S]*?```/.test(content)
    const estimatedReadingTime = Math.ceil(wordCount / 200) // 假设每分钟 200 字

    return {
      wordCount,
      hasCodeBlocks,
      estimatedReadingTime,
    }
  }

  /**
   * 从内容中提取标签
   */
  static extractTags(content: string): string[] {
    const tags: string[] = []

    // 检测编程语言
    const codeBlockRegex = /```(\w+)/g
    const languages = new Set<string>()
    let match
    while ((match = codeBlockRegex.exec(content)) !== null) {
      languages.add(match[1])
    }
    languages.forEach((lang) => tags.push(`lang:${lang}`))

    // 检测主题关键词（简单实现）
    const keywords = [
      'javascript',
      'typescript',
      'python',
      'react',
      'vue',
      'node',
      'ai',
      'machine learning',
      'deep learning',
      'database',
      'sql',
      'api',
      'tutorial',
      'guide',
      'documentation',
    ]

    const lowerContent = content.toLowerCase()
    keywords.forEach((keyword) => {
      if (lowerContent.includes(keyword)) {
        tags.push(keyword.replace(/\s+/g, '-'))
      }
    })

    return [...new Set(tags)] // 去重
  }

  /**
   * 自动生成标题
   * 优先级：
   * 1. Markdown 的第一个 # 标题
   * 2. 文件名（去掉扩展名）
   * 3. 内容的前 50 个字符
   */
  static generateTitle(filename: string, content: string): string {
    // 尝试从 Markdown 中提取第一个标题
    const h1Match = content.match(/^#\s+(.+)$/m)
    if (h1Match) {
      return h1Match[1].trim()
    }

    // 使用文件名（去掉扩展名和特殊字符）
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
    if (nameWithoutExt && nameWithoutExt.length > 0) {
      return nameWithoutExt
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // 使用内容的前 50 个字符
    const firstLine = content.split('\n')[0].trim()
    if (firstLine.length > 0) {
      return firstLine.slice(0, 50) + (firstLine.length > 50 ? '...' : '')
    }

    return 'Untitled'
  }

  /**
   * 验证文件类型
   */
  static isSupportedFileType(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase()
    return ['md', 'markdown', 'txt', 'pdf'].includes(extension || '')
  }

  /**
   * 验证文件大小（默认最大 10MB）
   */
  static isValidFileSize(size: number, maxSizeMB: number = 10): boolean {
    return size <= maxSizeMB * 1024 * 1024
  }

  /**
   * 获取文件类型描述
   */
  static getFileTypeDescription(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase()
    const typeMap: Record<string, string> = {
      md: 'Markdown 文档',
      markdown: 'Markdown 文档',
      txt: '纯文本文档',
      pdf: 'PDF 文档',
    }
    return typeMap[extension || ''] || '未知类型'
  }
}
