import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data, error } = await supabase.from('contact_pricing_overrides').select('*').limit(1)
  console.log('contact_pricing_overrides query:', { data, error: error?.message })
  const { data: q, error: qErr } = await supabase.from('quotes').select('standard_price, negotiated_discount_percent').limit(1)
  console.log('quotes new columns query:', { data: q, error: qErr?.message })
}
main()
