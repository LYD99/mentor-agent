/**
 * 文件处理服务
 * 支持 Markdown、TXT、PDF、图片、代码文件等格式的解析
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
  fileType?: string
  fileSize?: number
  imageInfo?: {
    width?: number
    height?: number
    format?: string
  }
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

    // 文档类型
    if (['md', 'markdown'].includes(extension || '')) {
      return this.processMarkdown(file, options)
    }
    if (extension === 'txt') {
      return this.processText(file, options)
    }
    if (extension === 'pdf') {
      return this.processPDF(file, options)
    }

    // 图片类型
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension || '')) {
      return this.processImage(file, options)
    }

    // 代码文件类型
    const codeExtensions = [
      'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp',
      'cs', 'php', 'rb', 'swift', 'kt', 'scala', 'r', 'sql', 'sh', 'bash',
      'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml',
      'toml', 'ini', 'conf', 'env', 'vue', 'svelte'
    ]
    if (codeExtensions.includes(extension || '')) {
      return this.processCode(file, options)
    }

    throw new Error(`Unsupported file type: ${extension}`)
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
   * 处理图片文件
   */
  static async processImage(
    file: File,
    options?: { extractMetadata?: boolean }
  ): Promise<ProcessedFile> {
    const title = this.generateTitle(file.name, '')
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    // 创建图片的 base64 数据 URL
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || `image/${extension}`
    const dataUrl = `data:${mimeType};base64,${base64}`
    
    // 获取图片尺寸
    let imageInfo: { width?: number; height?: number; format?: string } = {
      format: extension
    }
    
    if (typeof window !== 'undefined') {
      try {
        const img = new Image()
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = reject
          img.src = dataUrl
        })
        imageInfo.width = img.width
        imageInfo.height = img.height
      } catch (error) {
        console.warn('Failed to get image dimensions:', error)
      }
    }
    
    // 生成 Markdown 内容（使用占位符，实际图片数据存储在 metadata 中）
    const imageId = `image_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const contentMarkdown = [
      `# ${title}`,
      '',
      `> 图片文件: ${file.name}`,
      imageInfo.width && imageInfo.height 
        ? `> 尺寸: ${imageInfo.width} × ${imageInfo.height}` 
        : '',
      `> 大小: ${(file.size / 1024).toFixed(2)} KB`,
      '',
      '## 图片预览',
      '',
      `![${title}](${imageId})`,
      '',
      '---',
      `*从图片文件导入: ${new Date().toLocaleString('zh-CN')}*`
    ].filter(Boolean).join('\n')
    
    const metadata = {
      fileType: 'image',
      fileSize: file.size,
      imageInfo,
      // 将实际的图片数据存储在 metadata 中
      images: {
        [imageId]: dataUrl
      }
    }
    
    return {
      title,
      contentMarkdown,
      tags: ['image', extension || 'unknown'],
      metadata
    }
  }

  /**
   * 处理代码文件
   */
  static async processCode(
    file: File,
    options?: { extractMetadata?: boolean }
  ): Promise<ProcessedFile> {
    const content = await file.text()
    const title = this.generateTitle(file.name, content)
    const extension = file.name.split('.').pop()?.toLowerCase()
    const language = this.getLanguageName(extension || '')
    
    // 生成 Markdown 内容
    const contentMarkdown = [
      `# ${title}`,
      '',
      `> 代码文件: ${file.name}`,
      `> 语言: ${language}`,
      `> 大小: ${(file.size / 1024).toFixed(2)} KB`,
      `> 行数: ${content.split('\n').length}`,
      '',
      '## 代码内容',
      '',
      '```' + extension,
      content,
      '```',
      '',
      '---',
      `*从代码文件导入: ${new Date().toLocaleString('zh-CN')}*`
    ].join('\n')
    
    const tags = this.extractTags(content)
    tags.push('code', language.toLowerCase().replace(/\s+/g, '-'))
    
    const metadata = options?.extractMetadata
      ? {
          ...this.extractMetadata(content),
          fileType: 'code',
          fileSize: file.size,
          language
        }
      : undefined
    
    return {
      title,
      contentMarkdown,
      tags: [...new Set(tags)],
      metadata
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
      const pdfParseModule = await import('pdf-parse') as any
      const pdfParse = pdfParseModule.default || pdfParseModule
      
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

    // 使用文件名（保留扩展名，只替换特殊字符）
    if (filename && filename.length > 0) {
      return filename
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
   * 获取编程语言名称
   */
  static getLanguageName(extension: string): string {
    const languageMap: Record<string, string> = {
      // JavaScript/TypeScript
      js: 'JavaScript',
      jsx: 'JavaScript (JSX)',
      ts: 'TypeScript',
      tsx: 'TypeScript (TSX)',
      
      // Python
      py: 'Python',
      
      // Java/Kotlin
      java: 'Java',
      kt: 'Kotlin',
      
      // C/C++
      c: 'C',
      cpp: 'C++',
      cc: 'C++',
      cxx: 'C++',
      h: 'C/C++ Header',
      hpp: 'C++ Header',
      
      // C#
      cs: 'C#',
      
      // Go
      go: 'Go',
      
      // Rust
      rs: 'Rust',
      
      // PHP
      php: 'PHP',
      
      // Ruby
      rb: 'Ruby',
      
      // Swift
      swift: 'Swift',
      
      // Scala
      scala: 'Scala',
      
      // R
      r: 'R',
      
      // Shell
      sh: 'Shell',
      bash: 'Bash',
      
      // SQL
      sql: 'SQL',
      
      // Web
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      sass: 'Sass',
      less: 'Less',
      vue: 'Vue',
      svelte: 'Svelte',
      
      // Data
      json: 'JSON',
      xml: 'XML',
      yaml: 'YAML',
      yml: 'YAML',
      toml: 'TOML',
      ini: 'INI',
      conf: 'Config',
      env: 'Environment',
    }
    
    return languageMap[extension] || extension.toUpperCase()
  }

  /**
   * 验证文件类型
   */
  static isSupportedFileType(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase()
    
    // 文档类型
    const documentTypes = ['md', 'markdown', 'txt', 'pdf']
    
    // 图片类型
    const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
    
    // 代码类型
    const codeTypes = [
      'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp',
      'cs', 'php', 'rb', 'swift', 'kt', 'scala', 'r', 'sql', 'sh', 'bash',
      'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml',
      'toml', 'ini', 'conf', 'env', 'vue', 'svelte'
    ]
    
    return [...documentTypes, ...imageTypes, ...codeTypes].includes(extension || '')
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
    
    // 文档类型
    if (['md', 'markdown'].includes(extension || '')) return 'Markdown 文档'
    if (extension === 'txt') return '纯文本文档'
    if (extension === 'pdf') return 'PDF 文档'
    
    // 图片类型
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension || '')) {
      return `${extension?.toUpperCase()} 图片`
    }
    
    // 代码类型
    const codeTypes = [
      'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp',
      'cs', 'php', 'rb', 'swift', 'kt', 'scala', 'r', 'sql', 'sh', 'bash',
      'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml',
      'toml', 'ini', 'conf', 'env', 'vue', 'svelte'
    ]
    if (codeTypes.includes(extension || '')) {
      return `${this.getLanguageName(extension || '')} 代码文件`
    }
    
    return '未知类型'
  }
}
