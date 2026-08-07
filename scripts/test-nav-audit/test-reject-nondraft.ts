import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY)

  // Real authenticated session as the real tenant_admin (same path the Server Action's
  // own supabase client would resolve to) — bypasses the UI/browser entirely.
  const authedClient = createClient(SUPABASE_URL, ANON_KEY)
  const { data: signIn, error: signInErr } = await authedClient.auth.signInWithPassword({
    email: 'admin@devtest.local',
    password: 'DevTest123!',
  })
  if (signInErr || !signIn.session) {
    console.error('Sign-in failed:', signInErr?.message)
    process.exit(1)
  }
  const { data: userRow } = await serviceClient.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = userRow!.tenant_id

  const NON_DRAFT_INVOICE_ID = '2d7c0305-ecba-4daf-ad83-507d27c74385'
  const { data: before } = await serviceClient.from('invoices').select('id, status, subtotal, total, notes').eq('id', NON_DRAFT_INVOICE_ID).single()
  console.log('Target invoice BEFORE attack attempt:', JSON.stringify(before))

  // Call the exact same RPC the repository's updateDraftInvoice()/Server Action calls,
  // as a real authenticated tenant_admin session, with no UI involved.
  const { data, error } = await (authedClient as any).rpc('update_draft_invoice', {
    p_tenant_id: tenantId,
    p_invoice_id: NON_DRAFT_INVOICE_ID,
    p_notes: 'ATTACK: should never persist',
    p_line_items: [{ description: 'ATTACK ITEM', quantity: 1, unit_price: 999999, sort_order: 0 }],
  })

  console.log('\nRPC call result data:', JSON.stringify(data))
  console.log('RPC call error:', error ? JSON.stringify({ message: error.message, code: error.code }) : null)

  const { data: after } = await serviceClient.from('invoices').select('id, status, subtotal, total, notes').eq('id', NON_DRAFT_INVOICE_ID).single()
  console.log('\nTarget invoice AFTER attack attempt:', JSON.stringify(after))
  console.log('\nUnchanged (attack correctly rejected):', JSON.stringify(before) === JSON.stringify(after))
}
main()
