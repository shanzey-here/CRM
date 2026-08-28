import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isSocialModuleEnabled, listActiveAccounts } from '@/modules/social/server/repository'
import { ComposerForm } from './components/composer-form'
import { SocialHistoryList } from './components/social-history-list'
import { PlatformIcon, getPlatformColor } from './components/platform-icons'
import {
  Share2,
  Plus,
  Radio,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

const CONNECT_PLATFORMS = [
  { id: 'facebook', label: 'Facebook Page' },
  { id: 'instagram', label: 'Instagram Business' },
  { id: 'linkedin', label: 'LinkedIn Company' },
  { id: 'twitter', label: 'Twitter / X' },
]

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const moduleEnabled = await isSocialModuleEnabled(supabase, tenantId)

  if (!moduleEnabled) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Social Media Hub</h1>
            <p className="text-xs text-slate-500">Cross-platform scheduling & brand publishing</p>
          </div>
        </div>
        <div className="p-6 rounded-xl border border-amber-200 bg-amber-50/70 text-sm text-amber-900 shadow-xs flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="font-semibold text-amber-900">
              Social posting is not enabled on your current subscription plan
            </p>
            <p className="text-amber-800 text-xs leading-relaxed">
              Upgrade your plan to unlock automated multi-platform social broadcasting, scheduled queues, and unified post analytics.
            </p>
            <div className="pt-2">
              <Link
                href="/office/settings/billing"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <span>View Plans & Upgrades</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Fetch tenant settings for branding in preview
  const { data: tenantSettings } = await supabase
    .from('tenant_settings')
    .select('company_legal_name, logo_url')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const companyName = tenantSettings?.company_legal_name || 'Gomove Removals'
  const logoUrl = tenantSettings?.logo_url || null

  // Fetch connected accounts & posts
  const accounts = await listActiveAccounts(supabase, tenantId)

  const { data: posts, count, error } = await supabase
    .from('scheduled_posts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('scheduled_for', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const allPosts = posts ?? []
  const accountsById = new Map(accounts.map((a) => [a.id, a]))

  // Calculate Operational Metrics
  const scheduledCount = allPosts.filter((p) => p.status === 'pending').length
  const publishedCount = allPosts.filter((p) => p.status === 'published').length
  const failedCount = allPosts.filter((p) => p.status === 'failed').length
  const totalAttempted = publishedCount + failedCount
  const successRate = totalAttempted > 0 ? Math.round((publishedCount / totalAttempted) * 100) : 100

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header with Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight sm:text-3xl">
              Social Media Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Broadcast announcements, customer stories, and relocation tips across connected social channels.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>Connect Channel</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5">
              <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Select Platform
              </div>
              {CONNECT_PLATFORMS.map((platform) => {
                const colors = getPlatformColor(platform.id)
                return (
                  <a
                    key={platform.id}
                    href={`/api/social/connect/${platform.id}`}
                    className="flex items-center gap-2.5 px-2.5 py-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer transition-colors"
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center ${colors.bg} ${colors.text} border ${colors.border}`}
                    >
                      <PlatformIcon platform={platform.id} className="w-3 h-3" />
                    </div>
                    <span className="font-medium">{platform.label}</span>
                  </a>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Connected Accounts */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Connected Channels</span>
            <Radio className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{accounts.length}</span>
            <div className="flex items-center gap-1">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  title={`${a.display_name} (${a.platform})`}
                  className="w-5 h-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700"
                >
                  <PlatformIcon platform={a.platform} className="w-3 h-3" />
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            {accounts.length > 0
              ? `${accounts.length} active broadcasting profile(s)`
              : 'No accounts connected'}
          </p>
        </div>

        {/* Tile 2: Scheduled Queue */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Scheduled Queue</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{scheduledCount}</span>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              Pending
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {scheduledCount > 0
              ? `${scheduledCount} post(s) queued for publishing`
              : 'Queue is currently empty'}
          </p>
        </div>

        {/* Tile 3: Total Published */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Published</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{publishedCount}</span>
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Delivered
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Successful live platform broadcasts</p>
        </div>

        {/* Tile 4: Success Rate */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Success Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{successRate}%</span>
            <span className="text-xs font-medium text-slate-500">All-time</span>
          </div>
          <p className="text-[11px] text-slate-400">Isolated per-channel reliability</p>
        </div>
      </div>

      {/* No Accounts Connected Warning Banner */}
      {accounts.length === 0 && (
        <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">No social accounts connected yet</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Connect your business Facebook, Instagram, LinkedIn, or Twitter account to start scheduling and publishing.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {CONNECT_PLATFORMS.map((platform) => (
              <a
                key={platform.id}
                href={`/api/social/connect/${platform.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 shadow-2xs transition-colors"
              >
                <PlatformIcon platform={platform.id} className="w-3.5 h-3.5" />
                <span>{platform.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Composer Section */}
      {accounts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create New Social Post</h2>
              <p className="text-xs text-slate-500">
                Compose once and automatically broadcast to selected accounts.
              </p>
            </div>
          </div>

          <ComposerForm
            accounts={accounts.map((a) => ({
              id: a.id,
              platform: a.platform,
              display_name: a.display_name,
            }))}
            companyName={companyName}
            logoUrl={logoUrl}
          />
        </section>
      )}

      {/* Post History & Scheduled Queue Section */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Activity & Post History</h2>
          <p className="text-xs text-slate-500">
            View all queued posts, published messages, and delivery receipts.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            Failed to load post history: {error.message}
          </div>
        )}

        <SocialHistoryList
          posts={allPosts}
          accountsByIdMap={Object.fromEntries(accountsById)}
        />
      </section>
    </div>
  )
}
