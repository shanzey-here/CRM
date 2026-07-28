import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Recency-based, not embedding-based — no pgvector extension exists in this
// repo, and recency is the right-sized v1 choice for a tone reference, not a
// corner cut. Explicitly filtered by BOTH tenant_id and mailbox_id even
// though this is called with a service-role client that bypasses RLS —
// belt-and-suspenders on the one query this branch's cross-tenant-isolation
// test directly exercises.
export async function getToneSamples(
  serviceClient: SupabaseClient<Database>,
  tenantId: string,
  mailboxId: string,
  limit = 5
): Promise<string[]> {
  const { data, error } = await serviceClient
    .from('email_messages')
    .select('body_text')
    .eq('tenant_id', tenantId)
    .eq('mailbox_id', mailboxId)
    .eq('direction', 'outbound')
    .eq('authored_by', 'human')
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[ai-email] Failed to load tone samples:', error.message)
    return []
  }

  return (data ?? []).map((m) => m.body_text).filter((t): t is string => !!t && t.trim().length > 0)
}
