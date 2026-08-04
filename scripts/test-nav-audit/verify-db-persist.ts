import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data, error } = await serviceClient
    .from('leads')
    .select('id, stage, updated_at')
    .eq('id', '5183d2af-74ca-4fa7-8a2b-a0bbcbec7809')
    .single()
  console.log('Direct DB read of the dragged lead:', JSON.stringify(data), error?.message || '')
}
main()
