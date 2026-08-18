import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data, error } = await supabase.rpc('exec_sql' as any, {
    sql: `
      SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS ref_table
      FROM pg_constraint
      WHERE conrelid = 'quotes'::regclass AND contype = 'f'
    `,
  })
  if (error) {
    console.log('exec_sql rpc not available, trying direct query instead:', error.message)
  }
  console.log(JSON.stringify(data, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
