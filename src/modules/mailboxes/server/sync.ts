import { SupabaseClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'
import { simpleParser, ParsedMail } from 'mailparser'
import { Database } from '@/types/database.types'
import { getGmailAccessToken, getGmailClient } from './gmail-oauth'
import { getDecryptedCredential, markMailboxSyncSuccess, markMailboxSyncFailure, getActiveMailboxes } from './repository'
import { emitEvent } from '@/utils/supabase/event-bus'
import { maybeDraftAiReply } from '@/modules/ai-email/server/orchestrate'

type MailboxRow = Database['public']['Tables']['mailboxes']['Row']

const LOCK_STALE_THRESHOLD_MS = 15 * 60 * 1000 // 3x the 5-minute sync interval

export type MailboxSyncResult =
  | { mailboxId: string; ok: true; newMessages: number }
  | { mailboxId: string; ok: false; error: string; revoked?: boolean }

export type SyncRunResult =
  | { skipped: true; reason: 'lock_held' }
  | { skipped: false; results: MailboxSyncResult[] }

// Atomic overlap guard — see migration 00048 for why this is a flag row, not
// pg_try_advisory_lock (session-scoped locks aren't reliable through
// PostgREST's pooled connections in a stateless route).
async function acquireLock(serviceClient: SupabaseClient<Database>): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - LOCK_STALE_THRESHOLD_MS).toISOString()
  const { data } = await serviceClient
    .from('mailbox_sync_lock')
    .update({ is_running: true, started_at: new Date().toISOString() })
    .eq('id', true)
    .or(`is_running.eq.false,started_at.lt.${staleThreshold}`)
    .select()

  return !!data && data.length > 0
}

async function releaseLock(serviceClient: SupabaseClient<Database>) {
  await serviceClient.from('mailbox_sync_lock').update({ is_running: false }).eq('id', true)
}

export async function runMailboxSync(serviceClient: SupabaseClient<Database>): Promise<SyncRunResult> {
  const acquired = await acquireLock(serviceClient)
  if (!acquired) {
    return { skipped: true, reason: 'lock_held' }
  }

  try {
    const mailboxes = await getActiveMailboxes(serviceClient)
    const results: MailboxSyncResult[] = []

    // Sequential, not parallel — basic pacing against provider rate limits
    // (a full backoff/retry framework is out of scope for v1, per plan).
    for (const mailbox of mailboxes) {
      try {
        const newMessages = await syncMailbox(serviceClient, mailbox)
        await markMailboxSyncSuccess(serviceClient, mailbox.id)
        results.push({ mailboxId: mailbox.id, ok: true, newMessages })
      } catch (err: any) {
        const revoked = err?.revoked === true
        const message = err instanceof Error ? err.message : 'Unknown sync error'
        await markMailboxSyncFailure(serviceClient, mailbox.id, message)
        results.push({ mailboxId: mailbox.id, ok: false, error: message, revoked })
      }
    }

    return { skipped: false, results }
  } finally {
    await releaseLock(serviceClient)
  }
}

async function syncMailbox(serviceClient: SupabaseClient<Database>, mailbox: MailboxRow): Promise<number> {
  if (mailbox.connection_method === 'oauth' && mailbox.provider === 'gmail') {
    return syncGmailMailbox(serviceClient, mailbox)
  }
  if (mailbox.connection_method === 'imap_password') {
    return syncImapMailbox(serviceClient, mailbox)
  }
  throw new Error(`Unsupported mailbox configuration: provider=${mailbox.provider} connection_method=${mailbox.connection_method}`)
}

// ============================================================================
// Gmail sync
// ============================================================================

async function syncGmailMailbox(serviceClient: SupabaseClient<Database>, mailbox: MailboxRow): Promise<number> {
  const refreshToken = await getDecryptedCredential(serviceClient, mailbox.id)
  const tokenResult = await getGmailAccessToken(refreshToken)

  if ('revoked' in tokenResult) {
    const error: any = new Error(tokenResult.message)
    error.revoked = true
    throw error
  }
  if ('error' in tokenResult) {
    throw new Error(tokenResult.error)
  }

  const gmail = getGmailClient(tokenResult.accessToken)

  // v1 simplification: fetch the most recent N messages each run rather than
  // Gmail's historyId-based incremental sync. Bounded and cheap; the dedup
  // constraint makes re-fetching already-seen messages a correct no-op, not
  // a duplicate-row bug — this trades some API-quota efficiency for
  // simplicity, not correctness.
  const list = await gmail.users.messages.list({ userId: 'me', maxResults: 20 })
  const messageRefs = list.data.messages ?? []

  let newCount = 0

  for (const ref of messageRefs) {
    if (!ref.id) continue

    const full = await gmail.users.messages.get({ userId: 'me', id: ref.id, format: 'raw' })
    const raw = full.data.raw
    if (!raw) continue

    const rawBuffer = Buffer.from(raw, 'base64url')
    const parsed = await simpleParser(rawBuffer)

    const inserted = await upsertMessage(serviceClient, mailbox, parsed, {
      providerThreadId: full.data.threadId ?? undefined,
    })
    if (inserted) newCount++
  }

  return newCount
}

// ============================================================================
// Generic IMAP sync
// ============================================================================

async function syncImapMailbox(serviceClient: SupabaseClient<Database>, mailbox: MailboxRow): Promise<number> {
  const password = await getDecryptedCredential(serviceClient, mailbox.id)

  if (!mailbox.imap_host || !mailbox.imap_port || !mailbox.mailbox_address) {
    throw new Error('IMAP mailbox is missing host/port/address configuration')
  }

  const client = new ImapFlow({
    host: mailbox.imap_host,
    port: mailbox.imap_port,
    secure: mailbox.imap_port === 993,
    auth: { user: mailbox.mailbox_address, pass: password },
    logger: false,
  })

  let newCount = 0

  try {
    await client.connect()
  } catch (err: any) {
    // imapflow's raw error is a generic "Command failed" — the real reason
    // (e.g. "Login failed: authentication failure") is in responseText.
    // Same standard as the Gmail invalid_grant case: a specific,
    // human-readable message, not an opaque exception, since this is what
    // actually surfaces in the Settings UI's last_sync_error.
    if (err?.authenticationFailed) {
      throw new Error('IMAP login failed — check the username and password, then reconnect this mailbox')
    }
    throw new Error(err?.responseText || err?.message || 'IMAP connection failed')
  }

  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      // v1 simplification, same reasoning as Gmail: fetch all UIDs in INBOX
      // (bounded by test-mailbox size), dedup constraint handles re-fetches
      // correctly.
      for await (const message of client.fetch('1:*', { source: true })) {
        if (!message.source) continue
        const parsed = await simpleParser(message.source)
        const inserted = await upsertMessage(serviceClient, mailbox, parsed, {})
        if (inserted) newCount++
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }

  return newCount
}

// ============================================================================
// Shared message upsert + thread resolution
// ============================================================================

async function upsertMessage(
  serviceClient: SupabaseClient<Database>,
  mailbox: MailboxRow,
  parsed: ParsedMail,
  { providerThreadId }: { providerThreadId?: string }
): Promise<boolean> {
  const sourceMessageId = parsed.messageId ?? undefined
  const fromAddress = parsed.from?.value?.[0]?.address ?? 'unknown@unknown'
  const toAddresses = (parsed.to as any)?.value?.map((v: any) => v.address).filter(Boolean) ?? []
  const date = parsed.date ?? new Date()

  const direction: 'inbound' | 'outbound' =
    fromAddress.toLowerCase() === (mailbox.mailbox_address ?? '').toLowerCase() ? 'outbound' : 'inbound'

  // Check for an already-synced message BEFORE resolving/creating a thread.
  // Without this, re-syncing a message with no References header (e.g. the
  // very first message in a conversation, which by definition replies to
  // nothing) would call resolveThread() -> find no match -> create a fresh
  // empty thread on every single re-sync, even though the message upsert
  // below correctly no-ops via ON CONFLICT. The dedup check has to gate
  // thread creation too, not just the message row.
  if (sourceMessageId) {
    const { data: existing } = await serviceClient
      .from('email_messages')
      .select('id')
      .eq('tenant_id', mailbox.tenant_id)
      .eq('mailbox_id', mailbox.id)
      .eq('source_message_id', sourceMessageId)
      .maybeSingle()

    if (existing) return false
  }

  const threadId = await resolveThread(serviceClient, mailbox, parsed, providerThreadId)

  const { data, error } = await serviceClient
    .from('email_messages')
    .upsert(
      {
        tenant_id: mailbox.tenant_id,
        thread_id: threadId,
        mailbox_id: mailbox.id,
        direction,
        from_address: fromAddress,
        to_addresses: toAddresses,
        body_text: parsed.text ?? null,
        body_html: typeof parsed.html === 'string' ? parsed.html : null,
        sent_at: direction === 'outbound' ? date.toISOString() : null,
        received_at: direction === 'inbound' ? date.toISOString() : null,
        source_message_id: sourceMessageId ?? null,
        authored_by: 'human', // real mail synced from a real mailbox — never AI in this branch
        requires_approval: false,
      },
      { onConflict: 'tenant_id,mailbox_id,source_message_id', ignoreDuplicates: true }
    )
    .select('id')

  const wasInserted = !error && !!data && data.length > 0

  if (wasInserted) {
    await serviceClient.from('email_threads').update({ last_message_at: date.toISOString() }).eq('id', threadId)

    if (direction === 'inbound') {
      await emitEvent(
        serviceClient,
        'email.received',
        'email',
        { thread_id: threadId, message_id: data![0].id, from_address: fromAddress, mailbox_id: mailbox.id },
        mailbox.tenant_id
      )

      // Inline, not a separate async path — this codebase's only mechanism
      // decoupled from a live user request is this cron-triggered worker
      // itself (see 00044_phase2_email_db.sql's comment marking this exact
      // hook point). maybeDraftAiReply never throws — a drafting failure
      // must never break sync or lose the inbound message, which is already
      // safely persisted above.
      await maybeDraftAiReply(serviceClient, mailbox, threadId, data![0].id)
    }
  }

  return wasInserted
}

async function resolveThread(
  serviceClient: SupabaseClient<Database>,
  mailbox: MailboxRow,
  parsed: ParsedMail,
  providerThreadId?: string
): Promise<string> {
  // Gmail: use the provider's own thread grouping directly.
  if (providerThreadId) {
    const { data: existing } = await serviceClient
      .from('email_threads')
      .select('id')
      .eq('mailbox_id', mailbox.id)
      .eq('provider_thread_id', providerThreadId)
      .maybeSingle()

    if (existing) return existing.id

    const { data: created } = await serviceClient
      .from('email_threads')
      .insert({
        tenant_id: mailbox.tenant_id,
        mailbox_id: mailbox.id,
        provider_thread_id: providerThreadId,
        subject: parsed.subject ?? null,
        participant_addresses: collectParticipants(parsed),
      })
      .select('id')
      .single()
    return created!.id
  }

  // Generic IMAP: resolve via In-Reply-To/References against previously
  // seen source_message_id values in the same mailbox.
  const referenceIds = [
    ...(parsed.inReplyTo ? [parsed.inReplyTo] : []),
    ...(Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : []),
  ]

  if (referenceIds.length > 0) {
    const { data: match } = await serviceClient
      .from('email_messages')
      .select('thread_id')
      .eq('mailbox_id', mailbox.id)
      .in('source_message_id', referenceIds)
      .limit(1)
      .maybeSingle()

    if (match) return match.thread_id
  }

  const { data: created } = await serviceClient
    .from('email_threads')
    .insert({
      tenant_id: mailbox.tenant_id,
      mailbox_id: mailbox.id,
      subject: parsed.subject ?? null,
      participant_addresses: collectParticipants(parsed),
    })
    .select('id')
    .single()
  return created!.id
}

function collectParticipants(parsed: ParsedMail): string[] {
  const addresses = new Set<string>()
  if (parsed.from?.value) parsed.from.value.forEach((v) => v.address && addresses.add(v.address))
  const to = parsed.to as any
  if (to?.value) to.value.forEach((v: any) => v.address && addresses.add(v.address))
  return Array.from(addresses)
}
