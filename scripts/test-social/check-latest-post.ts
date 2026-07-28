import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data } = await supabase.from('scheduled_posts').select('*').order('created_at', { ascending: false }).limit(5)
  console.log(JSON.stringify(data, null, 2))
}
main()
