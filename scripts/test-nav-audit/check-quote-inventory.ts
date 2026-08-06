import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const quoteId = 'a7744406-5c2a-49e3-85db-cb3adf1cc6e0'
  const { data: quote } = await sc.from('quotes').select('*').eq('id', quoteId).single()
  console.log('Quote:', JSON.stringify(quote, null, 2))
  const { data: inv } = await sc.from('quote_inventory').select('*').eq('quote_id', quoteId)
  console.log('Quote inventory:', JSON.stringify(inv, null, 2))
  const { data: crew } = await sc.from('job_crew_assignments').select('*').eq('job_id', '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264')
  console.log('Existing crew assignments:', JSON.stringify(crew, null, 2))
}
main()
