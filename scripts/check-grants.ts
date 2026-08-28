import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function checkGrants() {
  const { data, error } = await admin.rpc('exec_sql', {
    query: `
      SELECT grantee, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'mailboxes';
    `
  })
  console.log('Grants on mailboxes:', data, error)

  // Also check column grants
  const { data: colData, error: colError } = await admin.rpc('exec_sql', {
    query: `
      SELECT grantee, column_name, privilege_type 
      FROM information_schema.column_privileges 
      WHERE table_name = 'mailboxes';
    `
  })
  console.log('Column privileges on mailboxes:', colData, colError)
}

checkGrants()
