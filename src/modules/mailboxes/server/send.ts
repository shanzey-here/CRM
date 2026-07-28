import { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import nodemailer from 'nodemailer'
import { Database } from '@/types/database.types'
import { getGmailAccessToken, getGmailClient } from './gmail-oauth'
import { getDecryptedCredential } from './repository'

type MailboxRow = Database['public']['Tables']['mailboxes']['Row']

// Shared by both send paths so header/threading construction can't drift
// between them. Generates a fresh Message-ID and sets In-Reply-To/References
// per RFC 5322 — this is what makes the reply thread correctly in the
// recipient's own mail client (any provider, any client), independent of
// Gmail's own proprietary threadId (which is set separately on the Gmail
// send call itself, for Gmail's own web UI).
export function buildOutboundMessage({
  from,
  to,
  subject,
  bodyText,
  inReplyTo,
  references,
}: {
  from: string
  to: string
  subject: string
  bodyText: string
  inReplyTo?: string | null
  references?: string | null
}): { raw: string; messageId: string } {
  const messageId = `<${randomUUID()}@${from.split('@')[1] || 'localhost'}>`
  const replySubject = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `Message-ID: ${messageId}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
  ]
    .filter(Boolean)
    .join('\r\n')

  return { raw: `${headers}\r\n\r\n${bodyText}`, messageId }
}

export type SendResult = { ok: true; sourceMessageId?: string } | { ok: false; error: string; revoked?: boolean }

async function sendViaGmail(
  serviceClient: SupabaseClient<Database>,
  mailbox: MailboxRow,
  raw: string,
  gmailThreadId: string | null
): Promise<SendResult> {
  const refreshToken = await getDecryptedCredential(serviceClient, mailbox.id)
  const tokenResult = await getGmailAccessToken(refreshToken)

  if ('revoked' in tokenResult) {
    return { ok: false, error: tokenResult.message, revoked: true }
  }
  if ('error' in tokenResult) {
    return { ok: false, error: tokenResult.error }
  }

  const gmail = getGmailClient(tokenResult.accessToken)

  try {
    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: Buffer.from(raw).toString('base64url'),
        threadId: gmailThreadId ?? undefined,
      },
    })

    // Gmail rewrites the Message-ID header on the copy it actually stores —
    // the value we generated in buildOutboundMessage() and put in `raw` is
    // NOT what comes back on the next sync. If we record our own generated
    // id as this message's source_message_id, the sync worker's dedup check
    // (keyed on source_message_id) won't recognize the synced copy as the
    // same message and will insert a duplicate row. Fetch the real header
    // Gmail assigned so the local record matches what sync will see.
    let sourceMessageId: string | undefined
    if (sent.data.id) {
      const meta = await gmail.users.messages.get({
        userId: 'me',
        id: sent.data.id,
        format: 'metadata',
        metadataHeaders: ['Message-ID'],
      })
      sourceMessageId = meta.data.payload?.headers?.find((h) => h.name?.toLowerCase() === 'message-id')?.value ?? undefined
    }

    return { ok: true, sourceMessageId }
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error?.message || err?.message || 'Gmail send failed' }
  }
}

async function sendViaSmtp(serviceClient: SupabaseClient<Database>, mailbox: MailboxRow, raw: string, to: string): Promise<SendResult> {
  if (!mailbox.smtp_host || !mailbox.smtp_port || !mailbox.mailbox_address) {
    return { ok: false, error: 'SMTP mailbox is missing host/port configuration' }
  }

  const password = await getDecryptedCredential(serviceClient, mailbox.id)

  const transporter = nodemailer.createTransport({
    host: mailbox.smtp_host,
    port: mailbox.smtp_port,
    secure: mailbox.smtp_port === 465,
    auth: { user: mailbox.mailbox_address, pass: password },
  })

  try {
    // nodemailer's `raw` option supplies only the DATA portion of the SMTP
    // transaction — it does NOT parse an envelope (MAIL FROM/RCPT TO) out of
    // the raw headers automatically. Found via a real failed send ("No
    // recipients defined") before this fix — envelope must be passed
    // explicitly alongside raw.
    await transporter.sendMail({ raw, envelope: { from: mailbox.mailbox_address, to } })
    return { ok: true }
  } catch (err: any) {
    // nodemailer's auth failures carry a `responseCode`/`response` with the
    // real SMTP server reply — same standard as the Gmail/IMAP cases: a
    // specific, human-readable reason, not an opaque exception.
    if (err?.code === 'EAUTH') {
      return { ok: false, error: 'SMTP login failed — check the username and password, then reconnect this mailbox' }
    }
    return { ok: false, error: err?.response || err?.message || 'SMTP send failed' }
  }
}

// Entry point used by the reply-send Server Action. Branches on
// connection_method the same way the sync worker does. Credential
// decryption happens only inside getDecryptedCredential, called only from
// here (service-role context) — never in a client-reachable path.
export async function sendMessage(
  serviceClient: SupabaseClient<Database>,
  mailbox: MailboxRow,
  raw: string,
  gmailThreadId: string | null,
  to: string
): Promise<SendResult> {
  if (mailbox.connection_method === 'oauth' && mailbox.provider === 'gmail') {
    return sendViaGmail(serviceClient, mailbox, raw, gmailThreadId)
  }
  if (mailbox.connection_method === 'imap_password') {
    return sendViaSmtp(serviceClient, mailbox, raw, to)
  }
  return { ok: false, error: `Unsupported mailbox configuration: provider=${mailbox.provider} connection_method=${mailbox.connection_method}` }
}
