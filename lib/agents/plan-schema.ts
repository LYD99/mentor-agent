import { z } from 'zod'

export const GrowthMapSchema = z.object({
  title: z.string(),
  description: z.string(),
  stages: z.array(z.object({
    title: z.string(),
    description: z.string(),
    durationWeeks: z.number(),
    goals: z.array(z.object({
      title: z.string(),
      description: z.string(),
      tasks: z.array(z.object({
        title: z.string(),
        description: z.string(),
        type: z.enum(['learn', 'practice', 'test', 'reflect']),
        durationDays: z.number(),
      })),
    })),
  })),
})

export type GrowthMapData = z.infer<typeof GrowthMapSchema>
