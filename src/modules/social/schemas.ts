import { z } from 'zod'

export const composePostSchema = z
  .object({
    content: z.string().min(1, 'Post content is required').max(5000, 'Post content must be 5000 characters or fewer'),
    accountIds: z.array(z.string().uuid()).min(1, 'Select at least one account'),
    scheduleMode: z.enum(['now', 'later']),
    scheduledFor: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleMode !== 'later') return

    if (!data.scheduledFor) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pick a date and time', path: ['scheduledFor'] })
      return
    }

    const parsed = new Date(data.scheduledFor)
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid date/time', path: ['scheduledFor'] })
      return
    }

    if (parsed.getTime() <= Date.now()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Scheduled time must be in the future', path: ['scheduledFor'] })
    }
  })

export type ComposePostInput = z.infer<typeof composePostSchema>
