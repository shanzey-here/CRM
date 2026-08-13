'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateCalendarEventStatus(
  eventId: string, 
  type: 'job' | 'task' | 'appointment', 
  status: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }
    
    const tenantId = user.app_metadata.tenant_id
    if (!tenantId) return { success: false, error: 'No tenant ID' }

    let table = ''
    if (type === 'job') table = 'jobs'
    else if (type === 'task') table = 'tasks'
    else if (type === 'appointment') table = 'appointments'
    else return { success: false, error: 'Invalid event type' }

    const { error } = await supabase
      .from(table)
      .update({ status })
      .eq('id', eventId)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error(`Failed to update ${type} status:`, error)
      return { success: false, error: error.message }
    }

    revalidatePath('/office/scheduling')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
