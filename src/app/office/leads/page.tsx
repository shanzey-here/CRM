import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getLeads } from '@/modules/leads/server/repository'
import { KanbanBoard } from './components/kanban-board'
import { KANBAN_STAGES } from './constants'
import type { KanbanStage } from './actions'

export const metadata = {
  title: 'Leads Pipeline | Gomove CRM',
  description: 'Manage your active leads pipeline with a drag-and-drop Kanban board.',
}

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = await createClient()

  // ──────────────────────────────────────────────────────────────────────────
  // Role guard is inherited from /office/layout.tsx which already enforces
  // tenant_admin | dispatcher only. This page requires no additional guard.
  // (Crew and Customer roles are blocked before this page ever executes.)
  // ──────────────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) redirect('/login?error=no_tenant_context')

  // Fetch ALL active leads in one query — we filter into columns client-side.
  // Exclude archived and completed from the board (they go to list view later).
  const activeStages = KANBAN_STAGES.map((s) => s.id) as KanbanStage[]

  // We fetch each active stage — Supabase doesn't support IN operator on
  // .eq() so we use a raw filter with the `in` method.
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id,
      contact_id,
      stage,
      preferred_move_date,
      estimated_volume,
      origin_address_id,
      destination_address_id,
      notes,
      created_at,
      updated_at,
      is_archived,
      tenant_id,
      source,
      assigned_to,
      created_by,
      updated_by
    `)
    .eq('tenant_id', tenantId)
    .eq('is_archived', false)
    .in('stage', activeStages)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[LeadsPage] Failed to fetch leads:', error.message)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      {/* Page Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Leads Pipeline
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {leads?.length ?? 0} active leads · Drag to update stage
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Stale ≥ 14 days
            </span>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden py-4">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-red-500">
              Failed to load leads. Please refresh the page.
            </p>
          </div>
        ) : (
          <KanbanBoard initialLeads={leads ?? []} />
        )}
      </div>
    </div>
  )
}
