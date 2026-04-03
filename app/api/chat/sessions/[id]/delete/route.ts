import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getEnv } from '@/lib/config/env-runtime'

const getLocalDataDir = () => getEnv('LOCAL_DATA_DIR') || './data/local'

/**
 * 删除会话（包括 JSONL 文件和数据库记录）
 * DELETE /api/chat/sessions/[id]/delete
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    // 验证权限
    const existingSession = await prisma.chatSession.findUnique({
      where: { id },
      select: {
        userId: true,
        title: true,
        jsonlPath: true,
      },
    })

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (existingSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 删除 JSONL 文件（修复：需要拼接完整路径）
    if (existingSession.jsonlPath) {
      const jsonlFullPath = path.join(
        process.cwd(),
        getLocalDataDir(),
        existingSession.jsonlPath
      )
      
      if (existsSync(jsonlFullPath)) {
        try {
          await unlink(jsonlFullPath)
          console.log(`[Delete Session] Deleted JSONL file: ${jsonlFullPath}`)
        } catch (error) {
          console.error('[Delete Session] Failed to delete JSONL file:', error)
          // 继续删除数据库记录，即使文件删除失败
        }
      } else {
        console.warn(`[Delete Session] JSONL file not found: ${jsonlFullPath}`)
      }
    }

    // 删除会话（v2.4: 不再需要删除消息索引）
    await prisma.chatSession.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `会话「${existingSession.title || '未命名'}」已删除`,
    })
  } catch (error) {
    console.error('Delete session error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
