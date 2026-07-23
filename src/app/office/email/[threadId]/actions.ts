'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { buildOutboundMessage, sendMessage } from '@/modules/mailboxes/server/send'

async function requireOfficeStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' as const }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) return { error: 'No tenant context' as const }

  // tenant_admin AND dispatcher — matches the existing /office layout guard
  // exactly (this page lives under /office, no new restriction). Email is
  // day-to-day operational tooling, not Settings-level.
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    return { error: 'Forbidden' as const }
  }

  return { supabase, tenantId }
}

export type SendReplyResult =
  | { success: true; recorded: true; messageId: string }
  | { success: true; recorded: false; warning: string }
  | { success: false; error: string }

export async function sendReplyAction(threadId: string, bodyText: string): Promise<SendReplyResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  if (!bodyText.trim()) return { success: false, error: 'Reply cannot be empty' }

  // Tenant-scoped reads via the caller's own authenticated client.
  const { data: thread, error: threadErr } = await supabase
    .from('email_threads')
    .select('id, subject, participant_addresses, mailbox_id, provider_thread_id, mailboxes:mailbox_id ( * )')
    .eq('id', threadId)
    .eq('tenant_id', tenantId)
    .single()

  if (threadErr || !thread) return { success: false, error: 'Thread not found' }

  const mailbox = thread.mailboxes as any
  if (!mailbox) return { success: false, error: 'This thread has no connected mailbox' }

  const { data: threadMessages } = await supabase
    .from('email_messages')
    .select('source_message_id, from_address, direction')
    .eq('thread_id', threadId)
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: true, nullsFirst: false })

  const messageIds = (threadMessages ?? []).map((m) => m.source_message_id).filter((id): id is string => !!id)
  const inReplyTo = messageIds.length > 0 ? messageIds[messageIds.length - 1] : null
  const references = messageIds.length > 0 ? messageIds.join(' ') : null

  // Reply goes to whoever sent the most recent inbound message, falling
  // back to the thread's recorded participants minus our own address.
  const lastInbound = [...(threadMessages ?? [])].reverse().find((m) => m.direction === 'inbound')
  const toAddress =
    lastInbound?.from_address ||
    (thread.participant_addresses ?? []).find((a) => a.toLowerCase() !== (mailbox.mailbox_address ?? '').toLowerCase()) ||
    ''

  if (!toAddress) return { success: false, error: 'Could not determine a recipient for this reply' }

  const { raw, messageId } = buildOutboundMessage({
    from: mailbox.mailbox_address,
    to: toAddress,
    subject: thread.subject || '(no subject)',
    bodyText,
    inReplyTo,
    references,
  })

  // Service-role client only for the actual send — credential decryption
  // happens inside sendMessage()/getDecryptedCredential(), never in this
  // action directly, matching the sync worker's boundary exactly.
  const serviceClient = createServiceRoleClient()
  const sendResult = await sendMessage(serviceClient, mailbox, raw, thread.provider_thread_id, toAddress)

  if (!sendResult.ok) {
    // Never sent — safe to tell the dispatcher to retry.
    return { success: false, error: sendResult.error }
  }

  // Sent for real. From here on, a failure to record it locally must NEVER
  // be reported as a send failure — that would imply retrying is safe, and
  // retrying now would send a real duplicate email to the customer.
  const insertRow = {
    tenant_id: tenantId,
    thread_id: threadId,
    mailbox_id: mailbox.id,
    direction: 'outbound' as const,
    from_address: mailbox.mailbox_address,
    to_addresses: [toAddress],
    body_text: bodyText,
    sent_at: new Date().toISOString(),
    source_message_id: messageId,
    authored_by: 'human' as const,
    requires_approval: false,
  }

  async function tryInsert() {
    return serviceClient
      .from('email_messages')
      .upsert(insertRow, { onConflict: 'tenant_id,mailbox_id,source_message_id', ignoreDuplicates: true })
      .select('id')
      .single()
  }

  let { data: inserted, error: insertErr } = await tryInsert()
  if (insertErr) {
    // One immediate retry — the realistic failure mode here is a transient
    // DB blip, not a structural problem (the row shape already succeeded
    // conceptually; sendMessage itself proved the mailbox is reachable).
    ;({ data: inserted, error: insertErr } = await tryInsert())
  }

  if (insertErr || !inserted) {
    return {
      success: true,
      recorded: false,
      warning: "Your reply was sent, but we couldn't save a record of it in this thread — check your Sent folder.",
    }
  }

  await serviceClient.from('email_threads').update({ last_message_at: insertRow.sent_at }).eq('id', threadId)

  revalidatePath(`/office/email/${threadId}`)
  return { success: true, recorded: true, messageId: inserted.id }
}

export async function associateThreadAction(threadId: string, { contactId, leadId }: { contactId?: string; leadId?: string }) {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { error: guard.error }
  const { supabase, tenantId } = guard

  const { error } = await supabase
    .from('email_threads')
    .update({ contact_id: contactId ?? null, lead_id: leadId ?? null })
    .eq('id', threadId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }

  revalidatePath(`/office/email/${threadId}`)
  return { success: true }
}

export async function searchContactsAndLeadsAction(query: string) {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { error: guard.error }
  const { supabase, tenantId } = guard

  if (!query.trim() || query.trim().length < 2) return { contacts: [], leads: [] }

  // Explicitly tenant-scoped on both queries — this is a genuinely new
  // search surface with no existing component to inherit scoping from, so
  // tenant_id is filtered directly here, not assumed from RLS alone.
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email')
    .eq('tenant_id', tenantId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(8)

  const { data: leads } = await supabase
    .from('leads')
    .select('id, stage, contacts:contact_id ( first_name, last_name )')
    .eq('tenant_id', tenantId)
    .limit(8)

  return { contacts: contacts ?? [], leads: leads ?? [] }
}

export async function createContactFromThreadAction(threadId: string, { firstName, lastName, email }: { firstName: string; lastName?: string; email: string }) {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { error: guard.error }
  const { supabase, tenantId } = guard

  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .insert({ tenant_id: tenantId, first_name: firstName, last_name: lastName || null, email, type: 'residential' })
    .select('id')
    .single()

  if (contactErr || !contact) return { error: contactErr?.message ?? 'Failed to create contact' }

  const { error: linkErr } = await supabase
    .from('email_threads')
    .update({ contact_id: contact.id })
    .eq('id', threadId)
    .eq('tenant_id', tenantId)

  if (linkErr) return { error: linkErr.message }

  revalidatePath(`/office/email/${threadId}`)
  return { success: true, contactId: contact.id }
}
