'use client'

import * as React from 'react'
import { useState } from 'react'
import { CalendarClock, FileText, PhoneCall, CheckCircle2, Zap } from 'lucide-react'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import {
  LeadQuickActionModals,
  type QuickActionType,
} from '../../components/lead-quick-action-modals'

// Same four real process triggers as the Kanban card
// (`src/app/office/leads/components/lead-card.tsx`) — same
// `LeadQuickActionModals` component, same `QuickActionType` union, same
// `activeAction` state shape. This bar is a second entry point onto that
// one shared implementation, not a second version of it.
const QUICK_ACTIONS: {
  type: QuickActionType
  label: string
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
}[] = [
  { type: 'schedule_survey', label: 'Schedule Survey', icon: CalendarClock, colorClass: 'text-emerald-700 hover:bg-emerald-50' },
  { type: 'send_quote', label: 'Send Quote', icon: FileText, colorClass: 'text-blue-700 hover:bg-blue-50' },
  { type: 'follow_up', label: 'Follow Up', icon: PhoneCall, colorClass: 'text-amber-700 hover:bg-amber-50' },
  { type: 'confirm_booking', label: 'Confirm Booking', icon: CheckCircle2, colorClass: 'text-indigo-700 hover:bg-indigo-50' },
]

export function LeadQuickActionsBar({ lead }: { lead: LeadWithContact }) {
  const [activeAction, setActiveAction] = useState<QuickActionType | null>(null)

  return (
    <>
      <div
        className="flex items-center gap-0.5 rounded-lg border border-amber-200 bg-amber-50/70 pl-2 pr-1 py-1"
        title="Quick Process Actions — real workflow triggers, distinct from the raw stage dropdown"
      >
        <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0 mr-1" aria-hidden="true" />
        {QUICK_ACTIONS.map(({ type, label, icon: Icon, colorClass }) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveAction(type)}
            title={label}
            aria-label={label}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${colorClass}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden xl:inline">{label}</span>
          </button>
        ))}
      </div>

      <LeadQuickActionModals
        lead={lead}
        activeAction={activeAction}
        onClose={() => setActiveAction(null)}
      />
    </>
  )
}
