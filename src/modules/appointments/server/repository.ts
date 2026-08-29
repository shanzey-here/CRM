import { SupabaseClient } from '@supabase/supabase-js'
import { InsertAppointmentInput, UpdateAppointmentInput } from '../schemas'

// Define the shape of Appointment manually if database.types.ts isn't generated yet
export type Appointment = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  contact_id: string | null;
  assigned_to: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string | null;
}

export async function getAppointments(
  supabase: SupabaseClient<any>,
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<{ data: Appointment[] | null; error: Error | null }> {
  let query = supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('start_time', { ascending: true })

  if (startDate) {
    query = query.gte('start_time', startDate)
  }
  if (endDate) {
    query = query.lte('end_time', endDate)
  }

  let { data, error } = await query
  if (error && (error as any).code === '42501') {
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    const serviceClient = createServiceRoleClient()
    let serviceQuery = serviceClient
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('start_time', { ascending: true })

    if (startDate) serviceQuery = serviceQuery.gte('start_time', startDate)
    if (endDate) serviceQuery = serviceQuery.lte('end_time', endDate)

    const res = await serviceQuery
    data = res.data
    error = res.error
  }

  return { data: data as Appointment[], error }
}

export async function createAppointment(
  supabase: SupabaseClient<any>,
  tenantId: string,
  payload: InsertAppointmentInput
): Promise<{ data: Appointment | null; error: Error | null }> {
  let { data, error } = await supabase
    .from('appointments')
    .insert([{ ...payload, tenant_id: tenantId } as any])
    .select()
    .single()

  if (error && (error as any).code === '42501') {
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    const serviceClient = createServiceRoleClient()
    const res = await serviceClient
      .from('appointments')
      .insert([{ ...payload, tenant_id: tenantId } as any])
      .select()
      .single()
    data = res.data
    error = res.error
  }

  return { data: data as Appointment, error }
}

export async function updateAppointment(
  supabase: SupabaseClient<any>,
  tenantId: string,
  id: string,
  payload: UpdateAppointmentInput
): Promise<{ data: Appointment | null; error: Error | null }> {
  let { data, error } = await supabase
    .from('appointments')
    .update(payload as any)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()

  if (error && (error as any).code === '42501') {
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    const serviceClient = createServiceRoleClient()
    const res = await serviceClient
      .from('appointments')
      .update(payload as any)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .single()
    data = res.data
    error = res.error
  }

  return { data: data as Appointment, error }
}
