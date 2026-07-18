import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { CreateJobFromQuoteData, JobSchema, Job } from '../schema'

export async function createJobFromQuoteTransaction(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  data: CreateJobFromQuoteData
) {
  // Call the transactional RPC. 
  // We use this to wrap Quote update, Job insert, Lead update, and Event insert 
  // into one ACID-compliant database transaction since the REST API lacks BEGIN/COMMIT.
  const { data: result, error } = await supabase.rpc('accept_quote_transaction', {
    p_tenant_id: tenantId,
    p_quote_id: data.quote_id,
    p_lead_id: data.lead_id || '',
    p_contact_id: data.contact_id,
    p_move_date: data.move_date || null,
    p_origin_address_id: data.origin_address_id || null,
    p_destination_address_id: data.destination_address_id || null
  })

  if (error) {
    return { success: false, error: 'Transaction failed: ' + error.message }
  }

  return { success: true, jobId: (result as any)?.job_id }
}

export async function getJobById(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  jobId: string
) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  const parsed = JobSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Data validation failed' }
  }

  return { success: true, job: parsed.data }
}
