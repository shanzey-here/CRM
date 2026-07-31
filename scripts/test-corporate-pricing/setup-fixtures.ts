import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function assertInsert(promise: any, table: string) {
  const { data, error } = await promise
  if (error) throw new Error(`Insert to ${table} failed: ${JSON.stringify(error)}`)
  return data
}

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  console.log('Using dev tenant:', tenantId)

  // Real pricing_settings already configured on this tenant (confirmed via
  // check-pricing-settings.ts): base_rate=100, per_cubic_foot_rate=0.5,
  // per_mile_rate=1, labor_hourly_rate=100, labour_hours_per_cubicft=0.1,
  // one 'stairs' surcharge of 50 (unused here, selectedSurcharges: []).

  // --- Negotiated contact: will get a real 15% override ---
  const negotiatedContact = await assertInsert(
    supabase
      .from('contacts')
      .insert({ tenant_id: tenantId, first_name: 'CorporatePricing', last_name: `Negotiated-${Date.now()}`, type: 'commercial' })
      .select()
      .single(),
    'contacts'
  )
  const negotiatedQuote = await assertInsert(
    supabase
      .from('quotes')
      .insert({ tenant_id: tenantId, contact_id: negotiatedContact.id, status: 'draft' })
      .select()
      .single(),
    'quotes'
  )

  // --- Standard contact: no override, regression check ---
  const standardContact = await assertInsert(
    supabase
      .from('contacts')
      .insert({ tenant_id: tenantId, first_name: 'CorporatePricing', last_name: `Standard-${Date.now()}`, type: 'residential' })
      .select()
      .single(),
    'contacts'
  )
  const standardQuote = await assertInsert(
    supabase
      .from('quotes')
      .insert({ tenant_id: tenantId, contact_id: standardContact.id, status: 'draft' })
      .select()
      .single(),
    'quotes'
  )

  console.log('\n=== FIXTURE IDS ===')
  console.log('TENANT_ID=' + tenantId)
  console.log('NEGOTIATED_CONTACT_ID=' + negotiatedContact.id)
  console.log('NEGOTIATED_QUOTE_ID=' + negotiatedQuote.id)
  console.log('STANDARD_CONTACT_ID=' + standardContact.id)
  console.log('STANDARD_QUOTE_ID=' + standardQuote.id)
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
