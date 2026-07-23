import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MailboxList } from './components/mailbox-list'
import { ConnectGmailButton } from './components/connect-gmail-button'
import { ConnectImapForm } from './components/connect-imap-form'

export const dynamic = 'force-dynamic'

export default async function MailboxSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: mailboxes } = await supabase
    .from('mailboxes')
    .select('id, provider, connection_method, mailbox_address, is_active, last_synced_at, last_sync_error, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Connected Mailboxes</h1>
      <p className="text-sm text-slate-500 mb-8">
        Connect an inbox so incoming customer emails land in one place. Gmail is connected via OAuth
        (recommended); other providers can use IMAP as a fallback.
      </p>

      {params.connected && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-sm">
          Connected {params.connected} successfully.
        </div>
      )}
      {params.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          Connection failed: {params.error.replace(/_/g, ' ')}
        </div>
      )}

      <div className="space-y-8 max-w-2xl">
        <MailboxList mailboxes={mailboxes ?? []} />

        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Connect a Mailbox</h3>
            <p className="text-sm text-slate-500">Gmail (OAuth) is recommended — no password ever leaves Google.</p>
          </div>
          <ConnectGmailButton />

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-3">
              Fallback — IMAP with password (less secure, use only if OAuth isn't available)
            </p>
            <ConnectImapForm />
          </div>
        </div>
      </div>
    </div>
  )
}
