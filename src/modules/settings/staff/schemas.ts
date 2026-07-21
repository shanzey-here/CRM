import { z } from 'zod'

export const inviteStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(1, 'Full name is required'),
  role: z.enum(['tenant_admin', 'dispatcher', 'crew'], {
    errorMap: () => ({ message: 'Role must be tenant_admin, dispatcher, or crew' }),
  }),
})

export const updateStaffRoleSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  role: z.enum(['tenant_admin', 'dispatcher', 'crew']),
})

export const deactivateStaffSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
})

export type InviteStaffInput = z.infer<typeof inviteStaffSchema>
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleSchema>
export type DeactivateStaffInput = z.infer<typeof deactivateStaffSchema>
