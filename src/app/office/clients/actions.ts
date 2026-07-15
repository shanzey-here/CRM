'use server'

import { createClient } from '@/utils/supabase/server'
import { updateContact } from '@/modules/clients/server/repository'
import { UpdateContactInput, updateContactSchema } from '@/modules/clients/schemas'
import { revalidatePath } from 'next/cache'

export async function updateContactAction(id: string, payload: UpdateContactInput) {
  // 1. Authenticate and extract Tenant ID
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { error: 'Unauthorized. Missing tenant context.' }
  }

  const tenantId = user.app_metadata.tenant_id

  // 2. Validate Payload (Defense in depth)
  const parseResult = updateContactSchema.safeParse(payload)
  if (!parseResult.success) {
    return { error: 'Validation failed.', issues: parseResult.error.issues }
  }

  // 3. Perform Update
  const { data, error } = await updateContact(supabase, tenantId, id, parseResult.data)

  if (error) {
    console.error('Update Contact Error:', error)
    return { error: error.message }
  }

  // 4. Revalidate exact paths
  revalidatePath(`/office/clients/${id}`)
  revalidatePath('/office/clients')

  return { success: true, data }
}
