import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspect() {
  const { data: user } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('email', 'admin@devtest.local')
    .single()

  const tenantId = user!.tenant_id!

  console.log('=== LEADS at confirmed_booking ===')
  const { data: leads } = await supabase
    .from('leads')
    .select('id, contact:contacts(first_name, last_name), stage, stage_id')
    .eq('tenant_id', tenantId)
    .eq('stage', 'confirmed_booking')
  console.log('Leads count:', leads?.length)
  leads?.forEach((l) =>
    console.log(
      'Lead:',
      l.id,
      (l.contact as any)?.first_name,
      (l.contact as any)?.last_name,
      l.stage
    )
  )

  console.log('\n=== ALL JOBS for this tenant ===')
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, move_date, quote_id, contact:contacts(first_name, last_name), quote:quotes(id, lead_id)')
    .eq('tenant_id', tenantId)
  console.log('Jobs count:', jobs?.length)
  jobs?.forEach((j) =>
    console.log(
      'Job ID:',
      j.id,
      'Status:',
      j.status,
      'Move date:',
      j.move_date,
      'Contact:',
      (j.contact as any)?.first_name,
      (j.contact as any)?.last_name,
      'Quote ID:',
      j.quote_id,
      'Linked Lead ID:',
      (j.quote as any)?.lead_id
    )
  )
}

inspect()
