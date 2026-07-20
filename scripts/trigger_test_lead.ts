import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function triggerLead() {
  console.log('Fetching a valid tenant...')
  
  // Get any tenant
  const { data: tenants, error: tErr } = await supabase.from('tenants').select('id, name').limit(1)
  if (tErr || !tenants || tenants.length === 0) {
    console.error('No tenants found in the database. Cannot create a lead.')
    process.exit(1)
  }
  const tenant = tenants[0]
  
  // Get an admin user for this tenant so we can tell the user who to log in as
  const { data: users, error: uErr } = await supabase.from('users').select('email').eq('tenant_id', tenant.id).eq('role', 'tenant_admin').limit(1)
  const email = users?.[0]?.email || 'unknown_admin@gomove.com'

  console.log(`Target Tenant: ${tenant.name}`)
  console.log(`You should be logged in as: ${email}`)
  console.log('Creating lead in 3 seconds... (Get your dashboard ready!)')

  // Get a valid contact
  const { data: contacts } = await supabase.from('contacts').select('id').eq('tenant_id', tenant.id).limit(1)
  let contactId = contacts?.[0]?.id
  if (!contactId) {
    const { data: newContact } = await supabase.from('contacts').insert({
      tenant_id: tenant.id,
      first_name: 'Test',
      last_name: 'Contact',
      type: 'residential'
    }).select('id').single()
    contactId = newContact!.id
  }

  const { data, error } = await supabase.from('leads').insert({
    tenant_id: tenant.id,
    contact_id: contactId,
    stage: 'inquiry',
    source: 'website',
    estimated_volume: 500
  }).select('id').single()

  if (error) {
    console.error('Failed to insert lead:', error)
  } else {
    console.log(`✅ Lead inserted successfully! ID: ${data.id}`)
    console.log(`You should hear a 'ding' and see a toast notification on your dashboard if Realtime is enabled.`)
  }
}

triggerLead().catch(console.error)
