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

  const { data, error } = await query
  return { data: data as Appointment[], error }
}

export async function createAppointment(
  supabase: SupabaseClient<any>,
  tenantId: string,
  payload: InsertAppointmentInput
): Promise<{ data: Appointment | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .insert([{ ...payload, tenant_id: tenantId } as any])
    .select()
    .single()

  return { data: data as Appointment, error }
}

export async function updateAppointment(
  supabase: SupabaseClient<any>,
  tenantId: string,
  id: string,
  payload: UpdateAppointmentInput
): Promise<{ data: Appointment | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('appointments')
    .update(payload as any)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()

  return { data: data as Appointment, error }
}
