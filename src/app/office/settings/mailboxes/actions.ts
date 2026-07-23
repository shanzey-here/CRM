'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createImapMailbox } from '@/modules/mailboxes/server/repository'
import { z } from 'zod'

const imapConnectSchema = z.object({
  mailbox_address: z.string().email(),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  password: z.string().min(1),
})

async function requireTenantAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' as const }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) return { error: 'No tenant context' as const }

  // HARD GUARD: only tenant_admin — mailbox credentials are the most
  // sensitive data this project stores; never enforced by UI-hiding alone.
  if (tenantRole !== 'tenant_admin') {
    return { error: 'Forbidden: only a tenant admin can manage mailboxes' as const }
  }

  return { tenantId }
}

export async function connectImapMailboxAction(formData: FormData) {
  const guard = await requireTenantAdmin()
  if ('error' in guard) return guard

  const parsed = imapConnectSchema.safeParse({
    mailbox_address: formData.get('mailbox_address'),
    host: formData.get('host'),
    port: formData.get('port'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const serviceClient = createServiceRoleClient()
  const { error } = await createImapMailbox(serviceClient, guard.tenantId, {
    mailboxAddress: parsed.data.mailbox_address,
    host: parsed.data.host,
    port: parsed.data.port,
    password: parsed.data.password,
  })

  if (error) {
    return { error: `Failed to save mailbox: ${error.message}` }
  }

  revalidatePath('/office/settings/mailboxes')
  return { success: true }
}

export async function disconnectMailboxAction(mailboxId: string) {
  const guard = await requireTenantAdmin()
  if ('error' in guard) return guard

  const supabase = await createClient()
  // Tenant-scoped via the caller's own authenticated client (RLS enforced),
  // not service-role — this is a normal tenant_admin-initiated write, not a
  // worker operation.
  const { error } = await supabase
    .from('mailboxes')
    .update({ is_active: false, last_sync_error: 'Disconnected by tenant admin' })
    .eq('id', mailboxId)
    .eq('tenant_id', guard.tenantId)

  if (error) return { error: error.message }

  revalidatePath('/office/settings/mailboxes')
  return { success: true }
}
