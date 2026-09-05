'use client'

import * as React from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  MapPin,
  Calendar,
  Clock,
  GripVertical,
  CalendarClock,
  FileText,
  PhoneCall,
  CheckCircle2,
  Zap,
  ChevronDown,
} from 'lucide-react'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  LeadQuickActionModals,
  type QuickActionType,
} from './lead-quick-action-modals'

interface LeadCardProps {
  lead: LeadWithContact
  isDragOverlay?: boolean
  isPending?: boolean
}

// Resolves a human-readable display name for the contact, handling missing names
// from bare web widget submissions by gracefully falling back to company name, email, phone, or 'Unnamed Contact'.
export function getContactDisplayName(contact?: {
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
} | {
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
}[] | null): string {
  const c = Array.isArray(contact) ? contact[0] : contact
  if (!c) return 'Unnamed Contact'

  const nameParts = [c.first_name, c.last_name].map((s) => s?.trim()).filter(Boolean)
  if (nameParts.length > 0) {
    return nameParts.join(' ')
  }

  if (c.company_name?.trim()) {
    return c.company_name.trim()
  }

  if (c.email?.trim()) {
    return c.email.trim()
  }

  if (c.phone?.trim()) {
    return c.phone.trim()
  }

  return 'Unnamed Contact'
}

// Formats how long a lead has been in its current stage
function timeInStage(updatedAt: string | null, createdAt: string): string {
  const reference = updatedAt ?? createdAt
  const diffMs = Date.now() - new Date(reference).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return '1 day'
  if (diffDays < 7) return `${diffDays} days`
  const weeks = Math.floor(diffDays / 7)
  if (weeks === 1) return '1 week'
  return `${weeks} weeks`
}

// Short label for a date string
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

type AddressPreviewData = { city: string; postcode: string } | null

// Displays a short city/postcode summary from the joined address row (see
// origin_address/destination_address in the Kanban query, office/leads/page.tsx).
// Falls back to a plain label when no address has been captured yet.
function AddressPreview({ address, type }: { address?: AddressPreviewData | AddressPreviewData[]; type: 'origin' | 'destination' }) {
  const a = Array.isArray(address) ? address[0] : address
  if (!a) {
    return <span className="text-slate-400 italic">{type === 'origin' ? 'Origin' : 'Destination'} TBC</span>
  }
  return <span>{a.city}</span>
}

export function LeadCard({ lead, isDragOverlay = false, isPending = false }: LeadCardProps) {
  const router = useRouter()
  const [activeAction, setActiveAction] = useState<QuickActionType | null>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const handleCardClick = () => {
    router.push(`/office/leads/${lead.id}`)
  }

  const staleThresholdDays = 14
  const diffDays = Math.floor(
    (Date.now() - new Date(lead.updated_at ?? lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  const isStale = diffDays >= staleThresholdDays

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onClick={handleCardClick}
        data-testid={`lead-card-${lead.id}`}
        className={[
          'group relative bg-white rounded-xl border px-3 py-3 select-none',
          'transition-all cursor-pointer',
          isDragging && !isDragOverlay
            ? 'opacity-40 scale-95 border-dashed border-slate-300 shadow-none'
            : 'border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5',
          isDragOverlay ? 'rotate-1 shadow-xl ring-2 ring-blue-400/40' : '',
          isPending ? 'pointer-events-none opacity-70' : '',
        ].join(' ')}
      >
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-3 right-2 text-slate-300 group-hover:text-slate-400 transition-colors"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Contact name — primary identifier on the card */}
        <p className="font-semibold text-sm text-slate-800 pr-6 truncate" title={getContactDisplayName(lead.contact)}>
          {getContactDisplayName(lead.contact)}
        </p>

        {/* Origin → Destination */}
        <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            <AddressPreview address={lead.origin_address} type="origin" />
            {' → '}
            <AddressPreview address={lead.destination_address} type="destination" />
          </span>
        </div>

        {/* Estimated move date */}
        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>Move: {formatDate(lead.preferred_move_date)}</span>
        </div>

        {/* Source & Time in stage */}
        <div className="flex items-center justify-between gap-1 mt-1.5 text-xs">
          {!!lead.source ? (
            <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize text-[11px]">
              {lead.source.replace(/_/g, ' ')}
            </span>
          ) : (
            <span />
          )}

          <div
            className={[
              'flex items-center gap-1 text-[11px] font-medium',
              isStale ? 'text-amber-600' : 'text-slate-400',
            ].join(' ')}
            title={isStale ? `This lead has been in this stage for ${diffDays} days` : undefined}
          >
            <Clock className="h-3 w-3 shrink-0" />
            <span suppressHydrationWarning>
              {timeInStage(lead.updated_at, lead.created_at)}
              {isStale && ' ⚠'}
            </span>
          </div>
        </div>

        {/* Quick Process Actions (real workflow triggers) */}
        <div
          className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-slate-400"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Direct 1-click icon buttons */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveAction('schedule_survey')
              }}
              title="Schedule Survey"
              aria-label="Schedule Survey"
              className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <CalendarClock className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveAction('send_quote')
              }}
              title="Send Quote"
              aria-label="Send Quote"
              className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveAction('follow_up')
              }}
              title="Log Follow-Up"
              aria-label="Log Follow-Up"
              className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <PhoneCall className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActiveAction('confirm_booking')
              }}
              title="Confirm Booking"
              aria-label="Confirm Booking"
              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Quick Actions Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              title="Quick Actions menu"
            >
              <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
              <span>Actions</span>
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Quick Process Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveAction('schedule_survey')
                }}
              >
                <CalendarClock className="h-4 w-4 text-emerald-600" />
                <div className="flex flex-col text-left">
                  <span className="font-medium text-slate-800">Schedule Survey</span>
                  <span className="text-[10px] text-slate-400">Book survey appointment</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveAction('send_quote')
                }}
              >
                <FileText className="h-4 w-4 text-blue-600" />
                <div className="flex flex-col text-left">
                  <span className="font-medium text-slate-800">Send Quote</span>
                  <span className="text-[10px] text-slate-400">Prepare & deliver proposal</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveAction('follow_up')
                }}
              >
                <PhoneCall className="h-4 w-4 text-amber-600" />
                <div className="flex flex-col text-left">
                  <span className="font-medium text-slate-800">Follow Up</span>
                  <span className="text-[10px] text-slate-400">Log activity & reminder</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveAction('confirm_booking')
                }}
              >
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <div className="flex flex-col text-left">
                  <span className="font-medium text-slate-800">Confirm Booking</span>
                  <span className="text-[10px] text-slate-400">Convert to scheduled job</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Action Entry Point Modal */}
      {!isDragOverlay && (
        <LeadQuickActionModals
          lead={lead}
          activeAction={activeAction}
          onClose={() => setActiveAction(null)}
        />
      )}
    </>
  )
}
