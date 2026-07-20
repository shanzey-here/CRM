import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as crypto from 'crypto'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function testQuery() {
  const tenantId = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

  const activeStages = [
    'inquiry',
    'survey_scheduled',
    'quote_sent',
    'follow_up',
    'confirmed_booking'
  ]

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select(`
      id,
      contact_id,
      stage,
      preferred_move_date,
      estimated_volume,
      origin_address_id,
      destination_address_id,
      notes,
      created_at,
      updated_at,
      is_archived,
      tenant_id,
      source,
      assigned_to,
      created_by,
      updated_by
    `)
    .eq('tenant_id', tenantId)
    .eq('is_archived', false)
    .in('stage', activeStages)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
  } else {
    console.log(`Found ${leads.length} leads`)
  }
}

testQuery().catch(console.error)
