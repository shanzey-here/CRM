import { createClient } from '@supabase/supabase-js'
import { emitEvent } from '../../src/utils/supabase/event-bus'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const { data: tenants } = await supabase.from('tenants').select('id')
  
  if (!tenants) return console.log('No tenants found')

  console.log(`Broadcasting to all ${tenants.length} tenants so you see it...`)
  
  for (const t of tenants) {
    const dummyLeadId = crypto.randomUUID()
    await emitEvent(supabase, 'lead.created', 'crm', { lead_id: dummyLeadId }, t.id)
  }
  
  console.log('✅ Done! Check your browser window.')
}

run()
