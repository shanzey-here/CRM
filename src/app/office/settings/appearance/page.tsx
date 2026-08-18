import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTenantSettings } from '@/modules/settings/branding/server/repository'
import { ThemePicker } from './components/theme-picker'
import type { UiTheme } from '@/modules/settings/theme/schemas'

export const dynamic = 'force-dynamic'

export default async function AppearanceSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: settings, error } = await getTenantSettings(supabase, tenantId)

  if (error || !settings) {
    return <div>Failed to load appearance settings: {error?.message || 'No data returned'}</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">Appearance</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Choose how the office dashboard looks for everyone at your company. This only affects your internal
        team&apos;s view — it does not change your branded proposals or customer-facing pages.
      </p>
      <ThemePicker currentTheme={(settings.ui_theme as UiTheme) ?? 'default'} />

      <div className="mt-8 max-w-xl rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-4 text-sm text-amber-800 dark:text-amber-300">
        <p className="font-medium">Known gap: Dark theme doesn&apos;t reach every page yet</p>
        <p className="mt-1 text-amber-700 dark:text-amber-400">
          The dashboard home, reports, navigation, and settings shell are fully theme-aware. About 106 other pages
          and components across Leads, Jobs, Clients, Scheduling, Fleet, Storage, Email, Settings sub-pages, and
          more still use fixed light-mode colors and will look inconsistent when Dark is selected. See{' '}
          <code className="rounded bg-amber-100 dark:bg-amber-900 px-1 py-0.5 text-xs">
            IMPLEMENTATION_SUMMARY_multi_theme_support.md
          </code>{' '}
          in the repo root for the full, itemized list.
        </p>
      </div>
    </div>
  )
}
