import { prisma } from '@/lib/db'

export async function buildContextPack(
  userId: string,
  options?: {
    maxItems?: number
    includeProfile?: boolean
    includeBehavior?: boolean
  }
): Promise<string> {
  const { maxItems = 10, includeProfile = true, includeBehavior = true } = options || {}
  
  const sections: string[] = []
  
  // 1. 用户画像
  if (includeProfile) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    })
    
    if (profile) {
      sections.push(`## User Profile
- Level: ${profile.currentLevel || 'unknown'}
- Interests: ${profile.interests || 'not specified'}
- Learning Style: ${profile.learningStyleJson || '{}'}
${profile.agentSummary ? `- Summary: ${profile.agentSummary}` : ''}`)
    }
  }
  
  // 2. 上下文条目（优先 pinned）
  const items = await prisma.userContextItem.findMany({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [
      { pinned: 'desc' },
      { createdAt: 'desc' },
    ],
    take: maxItems,
  })
  
  if (items.length > 0) {
    const itemsByCategory = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = []
      acc[item.category].push(item)
      return acc
    }, {} as Record<string, typeof items>)
    
    for (const [category, categoryItems] of Object.entries(itemsByCategory)) {
      sections.push(`## ${category.toUpperCase()}`)
      categoryItems.forEach(item => {
        sections.push(`- **${item.title}**: ${item.contentText || item.contentJson}`)
      })
    }
  }
  
  return sections.join('\n\n')
}
