import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { encryptCredential, decryptCredential } from './credential-crypto'

type MailboxRow = Database['public']['Tables']['mailboxes']['Row']

// A raw Node Buffer passed directly into supabase-js's insert/upsert payload
// gets JSON.stringify'd (Buffer.toJSON() -> {"type":"Buffer","data":[...]})
// before serialization, NOT stored as true bytea binary. PostgREST expects
// bytea values submitted as \x-prefixed hex text (Postgres's own external
// representation), which is also what it returns on SELECT — so encode
// explicitly on write to match what we already correctly decode on read.
function toBytea(buffer: Buffer): string {
  return '\\x' + buffer.toString('hex')
}

// Upsert on (tenant_id, mailbox_address), not a plain insert — reconnecting
// the same address (e.g. via the "Reconnect" action on a broken mailbox)
// updates the existing row (restoring is_active, clearing last_sync_error)
// instead of leaving a stale duplicate alongside a new one.
export async function createOAuthMailbox(
  serviceClient: SupabaseClient<Database>,
  tenantId: string,
  { provider, mailboxAddress, refreshToken, brandId }: { provider: 'gmail'; mailboxAddress: string; refreshToken: string; brandId?: string | null }
) {
  const encrypted = encryptCredential(refreshToken)

  return serviceClient
    .from('mailboxes')
    .upsert(
      {
        tenant_id: tenantId,
        brand_id: brandId ?? null,
        provider,
        connection_method: 'oauth',
        mailbox_address: mailboxAddress,
        encrypted_credential: toBytea(encrypted),
        is_active: true,
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,mailbox_address' }
    )
    .select('id, provider, mailbox_address, is_active, created_at')
    .single()
}

export async function createImapMailbox(
  serviceClient: SupabaseClient<Database>,
  tenantId: string,
  {
    mailboxAddress,
    host,
    port,
    smtpHost,
    smtpPort,
    password,
    brandId,
  }: { mailboxAddress: string; host: string; port: number; smtpHost: string; smtpPort: number; password: string; brandId?: string | null }
) {
  const encrypted = encryptCredential(password)

  return serviceClient
    .from('mailboxes')
    .upsert(
      {
        tenant_id: tenantId,
        brand_id: brandId ?? null,
        provider: 'imap_generic',
        connection_method: 'imap_password',
        mailbox_address: mailboxAddress,
        imap_host: host,
        imap_port: port,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        encrypted_credential: toBytea(encrypted),
        is_active: true,
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,mailbox_address' }
    )
    .select('id, provider, mailbox_address, is_active, created_at')
    .single()
}

// Only ever called from the service-role sync worker — never reachable from
// a normal authenticated user session (no Server Action or client-facing API
// exposes this). Decrypts the raw credential (refresh token or IMAP
// password) for immediate use, never returned to any client.
export async function getDecryptedCredential(
  serviceClient: SupabaseClient<Database>,
  mailboxId: string
): Promise<string> {
  const { data, error } = await serviceClient
    .from('mailboxes')
    .select('encrypted_credential')
    .eq('id', mailboxId)
    .single()

  if (error || !data?.encrypted_credential) {
    throw new Error(`No stored credential for mailbox ${mailboxId}`)
  }

  // PostgREST returns bytea as a "\x"-prefixed hex string over JSON.
  const hex = (data.encrypted_credential as unknown as string).replace(/^\\x/, '')
  return decryptCredential(Buffer.from(hex, 'hex'))
}

export async function getActiveMailboxes(serviceClient: SupabaseClient<Database>): Promise<MailboxRow[]> {
  const { data, error } = await serviceClient.from('mailboxes').select('*').eq('is_active', true)
  if (error) throw new Error(`Failed to list active mailboxes: ${error.message}`)
  return data ?? []
}

export async function markMailboxSyncSuccess(serviceClient: SupabaseClient<Database>, mailboxId: string) {
  await serviceClient
    .from('mailboxes')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
    .eq('id', mailboxId)
}

export async function markMailboxSyncFailure(serviceClient: SupabaseClient<Database>, mailboxId: string, message: string) {
  await serviceClient
    .from('mailboxes')
    .update({ is_active: false, last_sync_error: message })
    .eq('id', mailboxId)
}

export async function getTenantMailboxes(serviceClient: SupabaseClient<Database>, tenantId: string) {
  return serviceClient
    .from('mailboxes')
    .select('id, mailbox_address, provider, is_active, brand_id, brands(name)')
    .eq('tenant_id', tenantId)
}

export async function getMailboxById(serviceClient: SupabaseClient<Database>, mailboxId: string, tenantId: string) {
  return serviceClient
    .from('mailboxes')
    .select('id, mailbox_address, provider, is_active, brand_id, brands(name)')
    .eq('id', mailboxId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
}

