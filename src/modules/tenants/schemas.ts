import { z } from 'zod'

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Workspace Name is required')
    .max(100, 'Workspace Name cannot exceed 100 characters'),
  slug: z
    .string()
    .trim()
    .min(1, 'URL Slug is required')
    .max(50, 'URL Slug cannot exceed 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  adminFullName: z
    .string()
    .trim()
    .min(1, 'First Admin Full Name is required')
    .max(100, 'Name cannot exceed 100 characters'),
  adminEmail: z
    .string()
    .trim()
    .min(1, 'First Admin Email is required')
    .email('Invalid email address format'),
})

export type CreateTenantInput = z.infer<typeof createTenantSchema>
