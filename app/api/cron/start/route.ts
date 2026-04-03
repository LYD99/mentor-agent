import { startCronJobs } from '@/lib/jobs/cron'

let started = false

export async function GET() {
  if (!started) {
    startCronJobs()
    started = true
  }
  return Response.json({ status: 'ok' })
}
