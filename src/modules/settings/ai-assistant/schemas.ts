import { z } from 'zod'

export const aiQuotingModeSchema = z.enum(['off', 'assist', 'quote_review', 'auto_send'])

export type AiQuotingModeInput = z.infer<typeof aiQuotingModeSchema>
