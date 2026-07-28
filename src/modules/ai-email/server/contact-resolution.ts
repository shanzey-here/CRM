import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { createContact } from '@/modules/clients/server/repository'

type Contact = Database['public']['Tables']['contacts']['Row']

// Extracted, generalized version of the inline find-or-create pattern
// already used by the public leads route (src/app/api/public/leads/[formKey]/route.ts)
// — same tenant-scoped ilike match, same accepted known limitation: no
// unique constraint on contacts.email, so two near-simultaneous inbound
// messages from the same new sender could theoretically race into two
// contacts. Accepted here for the same reason the existing pattern accepts
// it — not solved in this branch, consistent with the project's existing
// tradeoff. Reuses createContact() (src/modules/clients/server/repository.ts)
// for the create path rather than a third inline insert.
export async function findOrCreateContactByEmail(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  { email, fallbackFirstName }: { email: string; fallbackFirstName: string }
): Promise<{ data: Contact | null; error: Error | null }> {
  const { data: existing } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('email', email)
    .maybeSingle()

  if (existing) return { data: existing, error: null }

  return createContact(supabase, tenantId, {
    type: 'residential',
    first_name: fallbackFirstName || 'Customer',
    last_name: null,
    email,
  })
}
