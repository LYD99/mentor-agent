import { Suspense } from 'react'
import { MentorChat } from '@/components/chat/mentor-chat'

export default function MentorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          加载中…
        </div>
      }
    >
      <MentorChat />
    </Suspense>
  )
}
