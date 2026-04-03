import { describe, it, expect, beforeEach } from 'vitest'
import { buildContextPack } from '@/lib/agents/context-pack'
import { prisma } from '@/lib/db'

describe('Context Pack', () => {
  let userId: string

  beforeEach(async () => {
    // Delete in correct order to avoid foreign key constraints
    await prisma.learningLesson.deleteMany()
    await prisma.chatSession.deleteMany()
    // researchResult 和 growthRequest 表已删除
    await prisma.scheduledTask.deleteMany()
    // v2.5: 清理测试数据（Goal 已移除，Task 改名为 LearningTask）
    await prisma.learningTask.deleteMany()
    await prisma.growthStage.deleteMany()
    await prisma.growthMap.deleteMany()
    await prisma.userContextItem.deleteMany()
    await prisma.userProfile.deleteMany()
    await prisma.user.deleteMany()
    
    const user = await prisma.user.create({
      data: {
        email: `test-context-${Date.now()}@example.com`,
        password: 'hash',
        name: 'Test',
        profile: {
          create: {
            currentLevel: 'intermediate',
            interests: 'web development, AI',
            learningStyleJson: JSON.stringify({
              preferredMedia: ['text', 'video'],
              pace: 'moderate',
            }),
          },
        },
        contextItems: {
          create: [
            {
              category: 'fact',
              title: 'Job',
              contentText: 'Backend engineer with 3 years Java experience',
              source: 'user',
              pinned: true,
            },
            {
              category: 'constraint',
              title: 'Time',
              contentText: 'Can study 2 hours daily, weekdays only',
              source: 'user',
            },
          ],
        },
      },
    })
    userId = user.id
  })

  it('should build context pack with profile and items', async () => {
    const pack = await buildContextPack(userId)
    
    expect(pack).toContain('intermediate')
    expect(pack).toContain('Backend engineer')
    expect(pack).toContain('2 hours daily')
    expect(pack.length).toBeLessThan(2000) // Token 控制
  })

  it('should prioritize pinned items', async () => {
    const pack = await buildContextPack(userId, { maxItems: 1 })
    
    expect(pack).toContain('Backend engineer') // pinned=true
  })

  it('should handle user without profile', async () => {
    const user2 = await prisma.user.create({
      data: {
        email: `test2-context-${Date.now()}@example.com`,
        password: 'hash',
        name: 'Test2',
      },
    })
    
    const pack = await buildContextPack(user2.id)
    
    expect(pack).toBe('') // No profile, no items
  })

  it('should exclude expired items', async () => {
    await prisma.userContextItem.create({
      data: {
        userId,
        category: 'constraint',
        title: 'Expired',
        contentText: 'This should not appear',
        source: 'system',
        expiresAt: new Date('2020-01-01'),
      },
    })
    
    const pack = await buildContextPack(userId)
    
    expect(pack).not.toContain('This should not appear')
  })
})
