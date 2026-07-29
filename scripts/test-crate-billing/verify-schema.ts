import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const cc = await supabase.from('crate_charges').select('*').limit(1)
  console.log('crate_charges query:', JSON.stringify(cc.data), 'error:', cc.error)

  const { data: contactCols } = await supabase.from('contacts').select('id, stripe_customer_id, default_payment_method_id').limit(1)
  console.log('contacts new columns queryable:', JSON.stringify(contactCols))

  const { data: pricingCols } = await supabase.from('pricing_settings').select('id, crate_overdue_rate_per_day, crate_lost_fee').limit(1)
  console.log('pricing_settings new columns:', JSON.stringify(pricingCols))

  // Test the RPCs exist and are callable (with bogus args expected to fail cleanly, not "function does not exist")
  const rpc1 = await supabase.rpc('create_crate_charge_invoice', {
    p_tenant_id: '00000000-0000-0000-0000-000000000000',
    p_crate_id: '00000000-0000-0000-0000-000000000000',
    p_contact_id: '00000000-0000-0000-0000-000000000000',
    p_charge_type: 'overdue_fee',
    p_period_start: '2026-01-01',
    p_amount: 5,
    p_description: 'test',
  })
  console.log('create_crate_charge_invoice RPC callable, result/error:', JSON.stringify(rpc1.data), rpc1.error?.message)
}
main()
