'use client'

import { useState, useTransition } from 'react'
import { Pencil, XCircle, Trash2 } from 'lucide-react'
import { AnnouncementRecord } from '@/modules/announcements/matching'
import { closeAnnouncementNowAction, deleteAnnouncementAction } from '../actions'
import { AnnouncementDialog } from './announcement-dialog'

type TenantOption = { id: string; name: string }
type PlanOption = { id: string; name: string }

interface Props {
  announcements: AnnouncementRecord[]
  tenants: TenantOption[]
  plans: PlanOption[]
}

function computeStatus(a: AnnouncementRecord, now: Date): 'scheduled' | 'expired' | 'live' {
  if (a.starts_at && new Date(a.starts_at) > now) return 'scheduled'
  if (a.ends_at && new Date(a.ends_at) < now) return 'expired'
  return 'live'
}

const STATUS_STYLES: Record<string, string> = {
  live: 'bg-emerald-50 border border-emerald-200 text-emerald-700',
  scheduled: 'bg-blue-50 border border-blue-200 text-blue-700',
  expired: 'bg-slate-100 border border-slate-200 text-slate-500',
}

const SEVERITY_STYLES: Record<AnnouncementRecord['severity'], string> = {
  info: 'bg-blue-50 border border-blue-200 text-blue-900',
  warning: 'bg-amber-50 border border-amber-200 text-amber-800',
  critical: 'bg-white border-2 border-red-600 text-red-700',
}

function targetSummary(a: AnnouncementRecord, tenants: TenantOption[], plans: PlanOption[]): string {
  if (a.target_type === 'all_tenants') return 'All Tenants'
  if (a.target_type === 'specific_tenants') {
    const names = tenants.filter((t) => a.target_ids.includes(t.id)).map((t) => t.name)
    return names.length > 0 ? names.join(', ') : `${a.target_ids.length} tenant(s)`
  }
  const names = plans.filter((p) => a.target_ids.includes(p.id)).map((p) => p.name)
  return names.length > 0 ? `Plan: ${names.join(', ')}` : `${a.target_ids.length} plan(s)`
}

export function AnnouncementList({ announcements, tenants, plans }: Props) {
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const now = new Date()

  function handleCloseNow(id: string) {
    if (!confirm('Close this announcement now? It will stop showing to tenants immediately.')) return
    setPendingId(id)
    startTransition(async () => {
      await closeAnnouncementNowAction(id)
      setPendingId(null)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this announcement permanently? This removes the historical record.')) return
    setPendingId(id)
    startTransition(async () => {
      await deleteAnnouncementAction(id)
      setPendingId(null)
    })
  }

  if (announcements.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm border border-dashed border-slate-200 rounded-lg">
        No announcements yet.
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Title</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Severity</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Target</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
            <th className="text-right px-4 py-3 font-medium text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {announcements.map((a) => {
            const status = computeStatus(a, now)
            return (
              <tr key={a.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{a.title}</div>
                  <div className="text-slate-500 text-xs line-clamp-1">{a.body}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_STYLES[a.severity]}`}>
                    {a.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{targetSummary(a, tenants, plans)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <AnnouncementDialog
                      tenants={tenants}
                      plans={plans}
                      existing={a}
                      trigger={
                        <button className="p-1.5 text-slate-400 hover:text-[var(--color-primary)] transition-colors" title="Edit">
                          <Pencil size={16} />
                        </button>
                      }
                    />
                    {status === 'live' && (
                      <button
                        onClick={() => handleCloseNow(a.id)}
                        disabled={isPending && pendingId === a.id}
                        className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors disabled:opacity-50"
                        title="Close now"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={isPending && pendingId === a.id}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
