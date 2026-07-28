import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const quoteId = process.argv[2]
  const { data: quote, error } = await supabase.from('quotes').select('*').eq('id', quoteId).single()
  console.log('error:', error)
  console.log(JSON.stringify(quote, null, 2))

  const { data: inventory } = await supabase.from('quote_inventory').select('*').eq('quote_id', quoteId)
  console.log('\ninventory:', JSON.stringify(inventory, null, 2))

  if (quote?.lead_id) {
    const { data: lead } = await supabase.from('leads').select('*').eq('id', quote.lead_id).single()
    console.log('\nlead:', JSON.stringify(lead, null, 2))
  }
}
main()
