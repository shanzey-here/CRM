'use client'

import { useRouter } from 'next/navigation'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MapPin, Calendar, Clock, GripVertical } from 'lucide-react'
import type { Lead } from '@/modules/leads/server/repository'

interface LeadCardProps {
  lead: Lead
  isDragOverlay?: boolean
  isPending?: boolean
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

// Displays an address summary — in practice the lead row stores address IDs
// not the full address text; this is a placeholder until address lookup is added
// as a join in a future enhancement.
function AddressPreview({ leadId, type }: { leadId: string; type: 'origin' | 'destination' }) {
  // TODO: once joined address data is passed in, render actual street/city
  return <span className="text-slate-400 italic text-xs">{type === 'origin' ? 'Origin' : 'Destination'} TBC</span>
}

export function LeadCard({ lead, isDragOverlay = false, isPending = false }: LeadCardProps) {
  const router = useRouter()
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
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleCardClick}
      className={[
        'group relative bg-white rounded-lg border px-3 py-3 select-none',
        'transition-all duration-150 cursor-pointer',
        isDragging && !isDragOverlay
          ? 'opacity-40 scale-95 border-dashed border-slate-300 shadow-none'
          : 'border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5',
        isDragOverlay ? 'rotate-1 shadow-xl ring-2 ring-indigo-400/40' : '',
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
      <p className="font-semibold text-sm text-slate-800 pr-6 truncate">
        {lead.contact_id /* Will be replaced with contact.full_name once join is added */}
      </p>

      {/* Origin → Destination */}
      <div className="flex items-center gap-1 mt-1.5 text-xs text-slate-500">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">
          <AddressPreview leadId={lead.id} type="origin" />
          {' → '}
          <AddressPreview leadId={lead.id} type="destination" />
        </span>
      </div>

      {/* Estimated move date */}
      <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
        <Calendar className="h-3 w-3 shrink-0" />
        <span>Move: {formatDate(lead.preferred_move_date)}</span>
      </div>

      {/* Source */}
      {!!lead.source && (
        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
            {lead.source.replace(/_/g, ' ')}
          </span>
        </div>
      )}

      {/* Time in stage — highlighted in amber/red when stale */}
      <div
        className={[
          'flex items-center gap-1 mt-1 text-xs font-medium',
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
  )
}
