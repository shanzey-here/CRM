import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data, error } = await sc.from('leads').update({ priority: 'medium', assigned_to: null }).eq('id', 'd292cd7a-576c-417c-8dee-9350bff59e67').select().single()
  console.log('Reset result:', JSON.stringify(data), error ? JSON.stringify(error) : '')
}
main()
