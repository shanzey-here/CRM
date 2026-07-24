import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAiAssistantSettings, hasActiveMailbox } from '@/modules/settings/ai-assistant/server/repository'
import { ModeSelector } from './components/mode-selector'

export const dynamic = 'force-dynamic'

export default async function AiAssistantSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: settings, error } = await getAiAssistantSettings(supabase, tenantId)
  if (error || !settings) {
    return <div>Failed to load AI Assistant settings: {error?.message || 'No data returned'}</div>
  }

  // Fresh query on every render, not client-side/cached state — the
  // warning below disappears on its own once a mailbox is actually
  // connected and this page is reloaded.
  const mailboxConnected = await hasActiveMailbox(supabase, tenantId)

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">AI Assistant</h1>
      <p className="text-sm text-slate-500 mb-8">
        Control whether AI drafts or sends email replies for your connected inbox, and how much
        review each reply gets before it reaches a customer.
      </p>

      {!mailboxConnected && (
        <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
          No mailbox is connected yet — this setting won't take effect until you connect one in{' '}
          <a href="/office/settings/mailboxes" className="underline font-medium">
            Settings → Mailboxes
          </a>
          .
        </div>
      )}

      <ModeSelector currentMode={settings.ai_quoting_mode} />
    </div>
  )
}
