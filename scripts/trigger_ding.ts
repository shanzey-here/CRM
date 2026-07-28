import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

async function triggerLead() {
  const tenantId = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

  console.log('Inserting a new test contact...')
  const { data: contact, error: contactError } = await supabaseAdmin.from('contacts').insert({
    tenant_id: tenantId,
    first_name: 'Ding',
    last_name: 'Tester',
    email: 'ding@example.com'
  }).select().single()

  if (contactError) {
    console.error('Failed to create contact:', contactError)
    return
  }

  console.log('Inserting a new inquiry lead to trigger the DING sound...')
  const { error: leadError } = await supabaseAdmin.from('leads').insert({
    tenant_id: tenantId,
    contact_id: contact.id,
    stage: 'inquiry',
    is_archived: false,
  })

  if (leadError) {
    console.error('Failed to create lead:', leadError)
  } else {
    console.log('Successfully inserted lead! The browser should DING immediately.')
  }
}

triggerLead()
