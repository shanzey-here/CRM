import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MY_TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1' // admin@devtest.local's real tenant
const OTHER_TENANT_ID = '33333333-3333-3333-3333-333333333333'
const OTHER_TENANT_INVOICE_ID = '4fa06773-6a85-4545-8d13-c2b5d8da7794' // real draft invoice, NOT belonging to admin@devtest.local

async function main() {
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: before } = await serviceClient.from('invoices').select('id, tenant_id, status, subtotal, total, notes').eq('id', OTHER_TENANT_INVOICE_ID).single()
  console.log('Target (other tenant) invoice BEFORE attack:', JSON.stringify(before))

  const authedClient = createClient(SUPABASE_URL, ANON_KEY)
  const { data: signIn } = await authedClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  console.log('\nSigned in as admin@devtest.local, real tenant:', MY_TENANT_ID)

  // Attempt 1: honest tenant_id (their own), targeting someone else's invoice_id.
  // This is what would happen if the Server Action's server-derived tenantId were used honestly
  // but the invoiceId (e.g. from a URL param) pointed at another tenant's row.
  console.log('\n--- Attempt 1: own tenant_id + other tenant\'s invoice_id ---')
  const r1 = await (authedClient as any).rpc('update_draft_invoice', {
    p_tenant_id: MY_TENANT_ID,
    p_invoice_id: OTHER_TENANT_INVOICE_ID,
    p_notes: 'CROSS-TENANT ATTACK 1',
    p_line_items: [{ description: 'ATTACK', quantity: 1, unit_price: 1, sort_order: 0 }],
  })
  console.log('Result:', JSON.stringify({ data: r1.data, error: r1.error ? { message: r1.error.message, code: r1.error.code } : null }))

  // Attempt 2: the real attack — spoof p_tenant_id to the OTHER tenant's real id directly in the RPC call,
  // bypassing the Server Action's server-derived tenantId entirely (calling the RPC directly, as if an
  // attacker scripted a raw request to PostgREST with a forged tenant_id parameter).
  console.log('\n--- Attempt 2: spoofed p_tenant_id = other tenant\'s real id + their real invoice_id ---')
  const r2 = await (authedClient as any).rpc('update_draft_invoice', {
    p_tenant_id: OTHER_TENANT_ID,
    p_invoice_id: OTHER_TENANT_INVOICE_ID,
    p_notes: 'CROSS-TENANT ATTACK 2 - SPOOFED TENANT ID',
    p_line_items: [{ description: 'ATTACK SPOOFED', quantity: 1, unit_price: 1, sort_order: 0 }],
  })
  console.log('Result:', JSON.stringify({ data: r2.data, error: r2.error ? { message: r2.error.message, code: r2.error.code } : null }))

  const { data: after } = await serviceClient.from('invoices').select('id, tenant_id, status, subtotal, total, notes').eq('id', OTHER_TENANT_INVOICE_ID).single()
  console.log('\nTarget (other tenant) invoice AFTER both attacks:', JSON.stringify(after))
  console.log('Unchanged:', JSON.stringify(before) === JSON.stringify(after))
}
main()
