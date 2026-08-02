import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import crypto from 'crypto'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const { data: contact } = await supabase
    .from('contacts')
    .insert({ tenant_id: tenantId, first_name: 'AcceptanceFlow', last_name: 'Regression', type: 'residential', email: `acceptance-regression-${Date.now()}@example.com` })
    .select()
    .single()

  const publicToken = crypto.randomUUID()
  const { data: quote } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      contact_id: contact!.id,
      status: 'sent',
      subtotal: 500,
      surcharge_total: 0,
      total_price: 500,
      deposit_amount: 0, // zero-deposit bypasses Stripe entirely — simplest real path to test
      public_token: publicToken,
      terms: 'Standard terms for regression test.',
    })
    .select()
    .single()

  console.log('TOKEN=' + publicToken)
  console.log('QUOTE_ID=' + quote!.id)
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
