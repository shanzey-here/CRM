import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { AiQuotingModeInput } from '../schemas'

export async function getAiAssistantSettings(supabase: SupabaseClient<Database>, tenantId: string) {
  const { data, error } = await supabase
    .from('tenant_settings')
    .select('ai_quoting_mode')
    .eq('tenant_id', tenantId)
    .single()

  return { data, error }
}

export async function updateAiQuotingMode(supabase: SupabaseClient<Database>, tenantId: string, mode: AiQuotingModeInput) {
  const { data, error } = await supabase
    .from('tenant_settings')
    .update({ ai_quoting_mode: mode })
    .eq('tenant_id', tenantId)
    .select('ai_quoting_mode')
    .single()

  return { data, error }
}

export async function hasActiveMailbox(supabase: SupabaseClient<Database>, tenantId: string): Promise<boolean> {
  const { data } = await supabase
    .from('mailboxes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(1)

  return !!data && data.length > 0
}

export type GraduationStatus = {
  total: number
  unedited: number
  rate: number
  qualifies: boolean
}

const GRADUATION_WINDOW = 20
const GRADUATION_THRESHOLD = 0.9

// The auto_send trust-graduation metric — last 20 resolved review-mode
// drafts (assist/quote_review only; auto_send itself never produces a
// row here, since resolveDraftOutcome never holds anything in that mode),
// approved-without-edit rate over that window. No time component, no
// caching — a real query, re-run on every check. Below the window size,
// qualifies is false regardless of rate.
export async function getGraduationStatus(supabase: SupabaseClient<Database>, tenantId: string): Promise<GraduationStatus> {
  const { data } = await supabase
    .from('ai_draft_resolutions')
    .select('outcome')
    .eq('tenant_id', tenantId)
    .order('resolved_at', { ascending: false })
    .limit(GRADUATION_WINDOW)

  const total = data?.length ?? 0
  const unedited = data?.filter((r) => r.outcome === 'approved_unedited').length ?? 0
  const rate = total > 0 ? unedited / total : 0

  return { total, unedited, rate, qualifies: total >= GRADUATION_WINDOW && rate >= GRADUATION_THRESHOLD }
}
