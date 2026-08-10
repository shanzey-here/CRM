'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { buildOutboundMessage, sendMessage } from '@/modules/mailboxes/server/send'
import { emailLabelSchema } from '@/modules/email-labels/schemas'
import { assignLabel, createLabel, findLabelByColor, removeLabelAssignment } from '@/modules/email-labels/server/repository'

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

  return { supabase, tenantId, userId: user.id }
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

  // Tenant-scoped reads via the caller's own authenticated client. The
  // mailboxes join deliberately lists only the columns `authenticated` is
  // actually granted (00046/00051/00053) — encrypted_credential is excluded
  // by a column-level GRANT allowlist, and selecting `( * )` here would fail
  // the WHOLE query with "permission denied", not just omit that field.
  // (Found this exact way, the hard way, testing this action for real.)
  // Never needed here anyway: getDecryptedCredential() does its own
  // separate service-role SELECT for the credential — this object's
  // encrypted_credential is never read.
  const { data: thread, error: threadErr } = await supabase
    .from('email_threads')
    .select(
      `id, subject, participant_addresses, mailbox_id, provider_thread_id,
       mailboxes ( id, tenant_id, provider, connection_method, mailbox_address, smtp_host, smtp_port, imap_host, imap_port )`
    )
    .eq('id', threadId)
    .eq('tenant_id', tenantId)
    .single()

  if (threadErr || !thread) return { success: false, error: `Thread not found${threadErr ? `: ${threadErr.message}` : ''}` }

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
    // Gmail rewrites the Message-ID header on send — sendViaGmail() fetches
    // the real assigned header and returns it as sourceMessageId so this
    // record matches what the sync worker's dedup check will see on the
    // next sync. Falls back to our own generated id for SMTP sends, which
    // preserve the client-supplied Message-ID as-is.
    source_message_id: sendResult.sourceMessageId ?? messageId,
    authored_by: 'human' as const,
    requires_approval: false,
  }

  async function tryInsert() {
    // Test-only seam, unset in every real environment: proves the
    // send-succeeded-but-record-failed path deterministically, without
    // which there's no reliable way to force this specific failure on
    // demand (the send itself has already succeeded for real at this point).
    if (process.env.SIMULATE_RECORD_FAILURE === 'true') {
      return { data: null, error: { message: 'Simulated record failure for testing' } } as any
    }
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

export type ApproveAiDraftResult =
  | { success: true; recorded: true }
  | { success: true; recorded: false; warning: string }
  | { success: false; error: string }

// Approves and sends a pending AI draft (authored_by = 'ai_draft_pending').
// Updates the existing row IN PLACE rather than inserting a new one —
// preserves message identity through review instead of duplicating it. See
// the plan's ordering note: occurred_at is NULL while pending (sorts last),
// and becomes the real send time on approval — identical to how a human
// reply already sorts, no special-casing needed.
export async function approveAiDraftAction(messageId: string, editedBodyText?: string): Promise<ApproveAiDraftResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  // Atomic claim — the only place a double-send race is actually closed.
  // A plain SELECT-then-check (what this used to be) lets two concurrent
  // calls for the same messageId both pass the authored_by check and both
  // reach sendMessage() below, genuinely double-sending a real email. This
  // UPDATE only ever matches for one concurrent caller: Postgres serializes
  // the two writes to the same row, and the loser's WHERE clause (still
  // requiring claimed_at IS NULL) evaluates false once the winner's claim
  // has committed.
  const { data: draft, error: draftErr } = await supabase
    .from('email_messages')
    .update({ claimed_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('tenant_id', tenantId)
    .eq('authored_by', 'ai_draft_pending')
    .is('claimed_at', null)
    .select('id, thread_id, mailbox_id, body_text')
    .maybeSingle()

  if (draftErr || !draft) {
    return { success: false, error: 'This draft has already been approved or discarded' }
  }

  // Releases the claim so the dispatcher can retry — only valid for a
  // failure that happens BEFORE sendMessage() is ever called. Once
  // sendMessage() has been attempted, releasing becomes unsafe (see the
  // block below the send call) so this helper is never used past that point.
  async function releaseClaimAndFail(error: string): Promise<ApproveAiDraftResult> {
    await supabase.from('email_messages').update({ claimed_at: null }).eq('id', messageId).eq('tenant_id', tenantId)
    return { success: false, error }
  }

  const bodyText = (editedBodyText ?? draft.body_text ?? '').trim()
  if (!bodyText) return releaseClaimAndFail('Reply cannot be empty')

  const { data: thread, error: threadErr } = await supabase
    .from('email_threads')
    .select(
      `id, subject, participant_addresses, provider_thread_id,
       mailboxes ( id, tenant_id, provider, connection_method, mailbox_address, smtp_host, smtp_port, imap_host, imap_port )`
    )
    .eq('id', draft.thread_id)
    .eq('tenant_id', tenantId)
    .single()

  if (threadErr || !thread) return releaseClaimAndFail(`Thread not found${threadErr ? `: ${threadErr.message}` : ''}`)

  const mailbox = thread.mailboxes as any
  if (!mailbox) return releaseClaimAndFail('This thread has no connected mailbox')

  const { data: threadMessages } = await supabase
    .from('email_messages')
    .select('id, source_message_id, from_address, direction')
    .eq('thread_id', draft.thread_id)
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: true, nullsFirst: false })

  const priorMessages = (threadMessages ?? []).filter((m) => m.id !== messageId)
  const messageIds = priorMessages.map((m) => m.source_message_id).filter((id): id is string => !!id)
  const inReplyTo = messageIds.length > 0 ? messageIds[messageIds.length - 1] : null
  const references = messageIds.length > 0 ? messageIds.join(' ') : null

  const lastInbound = [...priorMessages].reverse().find((m) => m.direction === 'inbound')
  const toAddress =
    lastInbound?.from_address ||
    (thread.participant_addresses ?? []).find((a) => a.toLowerCase() !== (mailbox.mailbox_address ?? '').toLowerCase()) ||
    ''

  if (!toAddress) return releaseClaimAndFail('Could not determine a recipient for this reply')

  const { raw, messageId: generatedMessageId } = buildOutboundMessage({
    from: mailbox.mailbox_address,
    to: toAddress,
    subject: thread.subject || '(no subject)',
    bodyText,
    inReplyTo,
    references,
  })

  const serviceClient = createServiceRoleClient()
  const sendResult = await sendMessage(serviceClient, mailbox, raw, thread.provider_thread_id, toAddress)

  if (!sendResult.ok) {
    // The send itself never happened — this is the LAST point at which
    // releasing the claim is safe. Every path after this line must never
    // clear claimed_at, even on failure.
    return releaseClaimAndFail(sendResult.error)
  }

  // Sent for real. From here on claimed_at is NEVER cleared, even if the
  // record-keeping update below fails — clearing it would let a future
  // approve attempt call sendMessage() again and genuinely double-send an
  // email that already went out. Same "sent but not recorded" distinction
  // sendReplyAction already established, applied to the claim itself, not
  // just the response message.
  const { error: updateErr } = await serviceClient
    .from('email_messages')
    .update({
      body_text: bodyText,
      to_addresses: [toAddress],
      sent_at: new Date().toISOString(),
      source_message_id: sendResult.sourceMessageId ?? generatedMessageId,
      authored_by: 'ai_sent',
      requires_approval: false,
    })
    .eq('id', messageId)
    .eq('tenant_id', tenantId)
    // No claimed_at release here on error — intentional, see comment above.

  if (updateErr) {
    return {
      success: true,
      recorded: false,
      warning: "Your reply was sent, but we couldn't update this thread's record of it — check the mailbox's Sent folder.",
    }
    // Row stays authored_by='ai_draft_pending' with claimed_at still set —
    // any future approve attempt's claim step finds no matching row
    // (claimed_at IS NOT NULL) and fails cleanly. It can never re-send.
  }

  await serviceClient.from('email_threads').update({ last_message_at: new Date().toISOString() }).eq('id', draft.thread_id)

  // Additive resolution-log entry for the auto_send trust-graduation
  // metric — only on the full success path (never for the recorded:false
  // case above, which is an infrastructure failure, not a signal about
  // draft quality). Best-effort: a logging failure here must never fail
  // the action itself, matching how emitEvent() calls elsewhere never
  // block their primary operation.
  const wasEdited = bodyText !== (draft.body_text ?? '').trim()
  const { error: resolutionErr } = await supabase.from('ai_draft_resolutions').insert({
    tenant_id: tenantId,
    mailbox_id: draft.mailbox_id,
    thread_id: draft.thread_id,
    message_id: messageId,
    outcome: wasEdited ? 'approved_edited' : 'approved_unedited',
  })
  if (resolutionErr) console.error('[ai-draft-resolutions] Failed to log approval resolution:', resolutionErr.message)

  revalidatePath(`/office/email/${draft.thread_id}`)
  return { success: true, recorded: true }
}

// Discards a pending AI draft without sending. The authored_by filter in
// the WHERE clause is an explicit safety guard — this can never delete a
// real human- or AI-sent message, even if a stale/wrong id were passed in.
// The claimed_at IS NULL predicate additionally guards two race cases: (1)
// a draft can't be discarded out from under an in-flight approve happening
// concurrently, and (2) a draft that's permanently stuck claimed after a
// send-succeeded-but-record-failed outcome (see approveAiDraftAction) can
// never be silently discarded — that row was actually sent for real, and
// discarding it would make an already-delivered email vanish as if it
// never happened.
export async function discardAiDraftAction(messageId: string): Promise<{ success: boolean; error?: string }> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const { data: draft } = await supabase
    .from('email_messages')
    .select('id, thread_id, mailbox_id')
    .eq('id', messageId)
    .eq('tenant_id', tenantId)
    .eq('authored_by', 'ai_draft_pending')
    .is('claimed_at', null)
    .maybeSingle()

  if (!draft) return { success: false, error: 'Pending draft not found' }

  const { error } = await supabase
    .from('email_messages')
    .delete()
    .eq('id', messageId)
    .eq('tenant_id', tenantId)
    .eq('authored_by', 'ai_draft_pending')
    .is('claimed_at', null)

  if (error) return { success: false, error: error.message }

  // Additive resolution-log entry, same reasoning as approveAiDraftAction —
  // best-effort, never fails the action itself.
  const { error: resolutionErr } = await supabase.from('ai_draft_resolutions').insert({
    tenant_id: tenantId,
    mailbox_id: draft.mailbox_id,
    thread_id: draft.thread_id,
    message_id: messageId,
    outcome: 'discarded',
  })
  if (resolutionErr) console.error('[ai-draft-resolutions] Failed to log discard resolution:', resolutionErr.message)

  revalidatePath(`/office/email/${draft.thread_id}`)
  return { success: true }
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

  // !inner forces an inner join so the embedded contacts columns are
  // filterable via {foreignTable: 'contacts'} — plain `contacts(...)` (a
  // left join) doesn't support filtering the embedded resource this way.
  // Verified empirically against the real DB before relying on it, given
  // the join-syntax mistake already found once in this same file.
  const { data: leads } = await supabase
    .from('leads')
    .select('id, stage, contacts!inner ( first_name, last_name )')
    .eq('tenant_id', tenantId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`, { foreignTable: 'contacts' })
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

export async function assignLabelToThreadAction(threadId: string, labelId: string): Promise<{ success: boolean; error?: string }> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId, userId } = guard

  const { error } = await assignLabel(supabase, tenantId, threadId, labelId, userId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/office/email/${threadId}`)
  revalidatePath('/office/email')
  return { success: true }
}

export async function removeLabelFromThreadAction(assignmentId: string, threadId: string): Promise<{ success: boolean; error?: string }> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const { error } = await removeLabelAssignment(supabase, tenantId, assignmentId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/office/email/${threadId}`)
  revalidatePath('/office/email')
  return { success: true }
}

// Inline "Create new label…" from the thread view's + Add label control —
// creates the label, then immediately assigns it to this thread. Same
// server-side re-validation and color-uniqueness handling as the Manage
// Labels form.
export async function createAndAssignLabelAction(
  threadId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string; label?: { id: string; name: string; color_hex: string } }> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId, userId } = guard

  const parsed = emailLabelSchema.safeParse({
    name: formData.get('name'),
    color_hex: formData.get('color_hex'),
  })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { data: created, error: createErr } = await createLabel(supabase, tenantId, parsed.data)
  if (createErr) {
    if (createErr.code === '23505') {
      const { data: conflicting } = await findLabelByColor(supabase, tenantId, parsed.data.color_hex)
      return {
        success: false,
        error: conflicting ? `This color is already used by ${conflicting.name} — pick a different one` : 'A label with this name or color already exists',
      }
    }
    return { success: false, error: createErr.message }
  }

  const { error: assignErr } = await assignLabel(supabase, tenantId, threadId, created.id, userId)
  if (assignErr) return { success: false, error: assignErr.message }

  revalidatePath(`/office/email/${threadId}`)
  revalidatePath('/office/email')
  return { success: true, label: { id: created.id, name: created.name, color_hex: created.color_hex } }
}
