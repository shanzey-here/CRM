import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function sync() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: user } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = user!.tenant_id!

  // 1. Get confirmed_booking stage
  const { data: confirmedStage } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('key', 'confirmed_booking')
    .single()

  if (!confirmedStage) {
    console.error('No confirmed_booking stage found!')
    return
  }

  // 2. Get all jobs for this tenant
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, tenant_id, brand_id, contact_id, move_date, origin_address_id, destination_address_id, customer_notes, status, quote:quotes(lead_id)')
    .eq('tenant_id', tenantId)
    .in('status', ['scheduled', 'in_progress'])

  console.log(`Found ${jobs?.length || 0} active/scheduled jobs.`)

  // 3. Get all leads for this tenant at confirmed_booking stage
  const { data: confirmedLeads } = await supabase
    .from('leads')
    .select('id, contact_id, notes')
    .eq('tenant_id', tenantId)
    .eq('stage', 'confirmed_booking')

  let syncedCount = 0
  for (const job of (jobs || [])) {
    const existingLeadId = (job.quote as any)?.lead_id
    if (existingLeadId) {
      // Ensure this lead is at stage confirmed_booking
      await supabase
        .from('leads')
        .update({
          stage: 'confirmed_booking',
          stage_id: confirmedStage.id,
          preferred_move_date: job.move_date || undefined,
        })
        .eq('id', existingLeadId)
      syncedCount++
    } else {
      // Check if a lead already references this job in notes or move_date
      const alreadyHasLead = (confirmedLeads || []).some(
        (l) => l.contact_id === job.contact_id && l.notes?.includes(`Job #${job.id.slice(0, 8)}`)
      )

      if (!alreadyHasLead) {
        // Create a lead record for this job
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert({
            tenant_id: tenantId,
            brand_id: job.brand_id,
            contact_id: job.contact_id,
            stage: 'confirmed_booking',
            stage_id: confirmedStage.id,
            preferred_move_date: job.move_date,
            origin_address_id: job.origin_address_id,
            destination_address_id: job.destination_address_id,
            notes: `Confirmed booking for Job #${job.id.slice(0, 8)}. ${job.customer_notes || ''}`,
            source: 'direct_booking',
          })
          .select()
          .single()

        if (error) {
          console.error('Error inserting lead for job:', job.id, error)
        } else {
          console.log(`✓ Created lead ${newLead.id} for job ${job.id}`)
          syncedCount++
        }
      }
    }
  }

  console.log(`Sync complete. Total synced/created: ${syncedCount}`)
}

sync()
