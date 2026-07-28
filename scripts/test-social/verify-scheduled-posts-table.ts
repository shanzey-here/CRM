import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data, error } = await supabase.from('scheduled_posts').select('*').limit(1)
  console.log('scheduled_posts query result:', JSON.stringify(data), 'error:', error)
}
main()
