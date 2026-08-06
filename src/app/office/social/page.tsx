import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isSocialModuleEnabled, listActiveAccounts } from '@/modules/social/server/repository'
import { ComposerForm } from './components/composer-form'
import { CancelButton } from './components/cancel-button'
import { SocialPostItem } from './components/social-post-item'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  published: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400',
}

const CONNECT_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'twitter']

type PublishResult = { accountId: string; ok: boolean; platformPostUrl?: string | null; error?: string }

export default async function SocialComposerPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Social</h1>
        <div className="mt-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
          Social posting isn&apos;t available on your current plan. Contact us to upgrade if you&apos;d like to enable it.
        </div>
      </div>
    )
  }

  const accounts = await listActiveAccounts(supabase, tenantId)

  const { data: posts, count, error } = await supabase
    .from('scheduled_posts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('scheduled_for', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1
  const accountsById = new Map(accounts.map((a) => [a.id, a]))

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Social</h1>
      <p className="text-sm text-slate-500 mb-8">Write a post, choose which connected accounts it goes to, and post now or schedule it for later.</p>

      {accounts.length === 0 ? (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800 mb-8">
          No social accounts are connected yet. Connect one to start posting:{' '}
          {CONNECT_PLATFORMS.map((platform, i) => (
            <span key={platform}>
              {i > 0 && ', '}
              <a href={`/api/social/connect/${platform}`} className="underline font-medium capitalize">
                {platform}
              </a>
            </span>
          ))}
          .
        </div>
      ) : (
        <div className="mb-8">
          <ComposerForm accounts={accounts.map((a) => ({ id: a.id, platform: a.platform, display_name: a.display_name }))} />
        </div>
      )}

      <h2 className="text-lg font-semibold text-slate-900 mb-3">Post history</h2>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">Failed to load post history: {error.message}</div>}

      {posts && posts.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg font-medium text-slate-700">No posts yet</p>
          <p className="text-sm mt-1">Posts you send or schedule will appear here.</p>
        </div>
      )}

      <div className="space-y-3">
        {(posts ?? []).map((post) => (
          <SocialPostItem 
            key={post.id} 
            post={post} 
            accountsByIdMap={Object.fromEntries(accountsById)} 
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Link
            href={`/office/social?page=${Math.max(1, page - 1)}`}
            className={`text-sm ${page <= 1 ? 'text-slate-300 pointer-events-none' : 'text-emerald-600 hover:underline'}`}
          >
            Previous
          </Link>
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/office/social?page=${Math.min(totalPages, page + 1)}`}
            className={`text-sm ${page >= totalPages ? 'text-slate-300 pointer-events-none' : 'text-emerald-600 hover:underline'}`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  )
}
