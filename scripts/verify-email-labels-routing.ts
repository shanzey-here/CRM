/**
 * Verifies approveLabelSuggestionAction's underlying logic (assignLabel +
 * deleteLabelSuggestion + emitEvent) with a REAL authenticated (non
 * service-role) Supabase client — the exact client shape the real Server
 * Action uses — bypassing only the browser/click layer, which is unrelated
 * to the bug being verified (the bug was emit_domain_event's tenantId
 * override rejection for non-service_role callers).
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

async function main() {
  const { assignLabel, deleteLabelSuggestion, getLabelAssignmentsForThread } = await import(
    '../src/modules/email-labels/server/repository'
  )
  const { emitEvent } = await import('../src/utils/supabase/event-bus')

  // Reset state.
  await admin.from('email_label_assignments').delete().eq('tenant_id', TENANT_A)
    .in('thread_id', (await admin.from('email_threads').select('id').eq('tenant_id', TENANT_A).eq('subject', 'Quote test - incomplete detail')).data!.map((t) => t.id))
  await admin.from('email_label_suggestions').delete().eq('tenant_id', TENANT_A)
  await admin.from('domain_events').delete().eq('tenant_id', TENANT_A).eq('event_type', 'email.label_added')

  const { data: thread } = await admin.from('email_threads').select('id').eq('tenant_id', TENANT_A).eq('subject', 'Quote test - incomplete detail').single()
  const { data: label } = await admin.from('email_labels').select('id, name').eq('tenant_id', TENANT_A).eq('name', 'Payment Pending').single()
  const { data: user } = await admin.from('users').select('id').eq('email', 'admin@devtest.local').single()

  await admin.from('email_label_suggestions').insert({ tenant_id: TENANT_A, thread_id: thread!.id, label_id: label!.id, model: 'final-test' })
  console.log(`Fresh pending suggestion created: thread=${thread!.id}, label=${label!.name} (${label!.id})`)

  // Real sign-in, real session, real JWT — the exact client shape
  // createClient() from '@/lib/supabase/server' produces in the real app.
  const { data: authData, error: authError } = await anon.auth.signInWithPassword({
    email: 'admin@devtest.local',
    password: 'DevTest123!',
  })
  if (authError || !authData.session) throw new Error(`Sign-in failed: ${authError?.message}`)
  console.log('Real sign-in succeeded, real session JWT obtained.')

  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
  })

  console.log('\n=== Replicating approveLabelSuggestionAction with the real authenticated client ===')
  const { error: assignError } = await assignLabel(userClient, TENANT_A, thread!.id, label!.id, user!.id)
  console.log('assignLabel error:', assignError?.message ?? 'none (success)')

  await deleteLabelSuggestion(userClient, TENANT_A, thread!.id, label!.id)

  // THE FIX: no tenantId override for a non-service_role caller.
  const { error: eventError } = await emitEvent(userClient, 'email.label_added', 'ai-email', { thread_id: thread!.id, label_id: label!.id })
  console.log('emitEvent error (this is what the bug produced before the fix):', eventError?.message ?? 'none (success)')

  const { data: remainingSuggestions } = await admin.from('email_label_suggestions').select('id').eq('tenant_id', TENANT_A)
  const { data: assignments } = await getLabelAssignmentsForThread(admin, TENANT_A, thread!.id)
  const { data: events } = await admin.from('domain_events').select('id, payload, occurred_at').eq('tenant_id', TENANT_A).eq('event_type', 'email.label_added')

  console.log('\n=== Real results ===')
  console.log('Remaining pending suggestions (expect 0):', remainingSuggestions?.length ?? 0)
  console.log('Real assignment created:', JSON.stringify(assignments, null, 2))
  console.log('Real domain_events row (expect 1, proving the fix):', JSON.stringify(events, null, 2))

  await anon.auth.signOut()
}

main().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
