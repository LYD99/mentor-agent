import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, GraduationCap, Map, Bot, Sparkles } from 'lucide-react'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const modules = [
    {
      href: '/mentor',
      icon: MessageSquare,
      title: 'Mentor',
      gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
      hoverShadow: 'hover:shadow-blue-500/20',
    },
    {
      href: '/advisor',
      icon: GraduationCap,
      title: 'Advisor',
      gradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-600',
      hoverShadow: 'hover:shadow-purple-500/20',
    },
    {
      href: '/growth',
      icon: Map,
      title: '成长地图',
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      hoverShadow: 'hover:shadow-emerald-500/20',
    },
    {
      href: '/bot',
      icon: Bot,
      title: 'Bot 配置',
      gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
      hoverShadow: 'hover:shadow-amber-500/20',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">欢迎回来，{session.user.name || session.user.email}</span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            选择你的工作台
          </h1>
        </div>

        {/* Module Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <Link
                key={module.href}
                href={module.href}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${module.hoverShadow}`}
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${module.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                
                {/* Content */}
                <div className="relative">
                  <div className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl ${module.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                    <Icon className={`h-8 w-8 ${module.iconColor}`} />
                  </div>
                  <h2 className="font-display text-2xl font-semibold tracking-tight">
                    {module.title}
                  </h2>
                </div>

                {/* Hover Arrow */}
                <div className="absolute bottom-8 right-8 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-1">
                  <svg
                    className="h-6 w-6 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
