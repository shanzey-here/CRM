import { z } from 'zod'

export const announcementSeverityEnum = z.enum(['info', 'warning', 'critical'])
export const announcementTargetTypeEnum = z.enum(['all_tenants', 'specific_tenants', 'by_plan'])

export const announcementFormSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(200),
    body: z.string().min(1, 'Body is required'),
    severity: announcementSeverityEnum,
    target_type: announcementTargetTypeEnum,
    target_ids: z.array(z.string().uuid()).default([]),
    dismissible: z.boolean().default(true),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
  })
  .refine((data) => data.target_type === 'all_tenants' || data.target_ids.length > 0, {
    message: 'Select at least one target for this target type',
    path: ['target_ids'],
  })
  .refine(
    (data) =>
      !data.starts_at || !data.ends_at || new Date(data.starts_at) < new Date(data.ends_at),
    { message: 'Start time must be before end time', path: ['ends_at'] }
  )

export type AnnouncementFormInput = z.infer<typeof announcementFormSchema>
export type AnnouncementSeverity = z.infer<typeof announcementSeverityEnum>
export type AnnouncementTargetType = z.infer<typeof announcementTargetTypeEnum>
