'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LeadCard } from './lead-card'
import type { Lead } from '@/modules/leads/server/repository'
import type { KanbanStage } from '../actions'

interface ColumnDef {
  id: KanbanStage
  label: string
  color: string
}

interface KanbanColumnProps {
  stage: ColumnDef
  leads: Lead[]
  isPending: boolean
}

export function KanbanColumn({ stage, leads, isPending }: KanbanColumnProps) {
  // The column itself is a drop target — its id matches the stage value
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div
      className="flex flex-col shrink-0 w-72 rounded-xl overflow-hidden"
      style={{
        boxShadow: isOver
          ? `0 0 0 2px ${stage.color}50, 0 4px 20px ${stage.color}20`
          : undefined,
        transition: 'box-shadow 150ms ease',
      }}
    >
      {/* Column Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white font-semibold text-sm"
        style={{ backgroundColor: stage.color }}
      >
        <span>{stage.label}</span>
        <span
          className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-xs font-bold"
        >
          {leads.length}
        </span>
      </div>

      {/* Drop zone — the node ref goes here */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 p-2 flex-1 min-h-32 overflow-y-auto bg-slate-100/80 rounded-b-xl"
        style={{
          backgroundColor: isOver ? `${stage.color}08` : undefined,
          transition: 'background-color 150ms ease',
        }}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} isPending={isPending} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-slate-400 italic rounded-lg border-2 border-dashed border-slate-200">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}
