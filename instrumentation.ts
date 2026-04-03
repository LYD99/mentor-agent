/**
 * Next.js Instrumentation
 * 在应用启动时自动执行的初始化代码
 * 
 * 文档: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 只在 Node.js 运行时启动 cron jobs（不在 Edge Runtime 中）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCronJobs } = await import('./lib/jobs/cron')
    await startCronJobs()
  }
}
