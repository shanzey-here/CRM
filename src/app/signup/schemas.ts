import { z } from 'zod'

export const signupSchema = z.object({
  companyName: z.string().min(2, 'Company Name must be at least 2 characters'),
  fullName: z.string().min(2, 'Full Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
})

export type SignupInput = z.infer<typeof signupSchema>
