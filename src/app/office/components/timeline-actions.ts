'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createActivity } from '@/modules/activities/server/repository'
import { z } from 'zod'

const addNoteSchema = z.object({
  contact_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  content: z.string().min(1, 'Note content is required'),
}).refine(data => data.contact_id || data.lead_id, {
  message: "Must provide either contact_id or lead_id",
  path: ["contact_id"]
});

export async function addNoteAction(payload: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata?.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id

  const parsed = addNoteSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed' }
  }

  const { data, error } = await createActivity(supabase, tenantId, {
    contact_id: parsed.data.contact_id || null,
    lead_id: parsed.data.lead_id || null,
    type: 'note',
    content: parsed.data.content,
    created_by: user.id
  })

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to add note' }
  }

  if (parsed.data.contact_id) {
    revalidatePath(`/office/clients/${parsed.data.contact_id}`)
  }
  if (parsed.data.lead_id) {
    revalidatePath(`/office/leads/${parsed.data.lead_id}`)
  }

  return { success: true }
}
