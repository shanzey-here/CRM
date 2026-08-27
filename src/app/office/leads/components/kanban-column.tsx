'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { motion, useReducedMotion } from 'framer-motion'
import { LeadCard } from './lead-card'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import type { KanbanStage } from '../actions'

interface ColumnDef {
  id: KanbanStage
  label: string
  color: string
}

interface KanbanColumnProps {
  stage: ColumnDef
  leads: LeadWithContact[]
  isPending: boolean
  index: number
}

export function KanbanColumn({ stage, leads, isPending, index }: KanbanColumnProps) {
  // The column itself is a drop target — its id matches the stage value
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const shouldReduceMotion = useReducedMotion()

  const motionProps = shouldReduceMotion ? {} : {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.25,
      delay: index * 0.05,
      ease: [0.25, 0.1, 0.25, 1.0],
    }
  }

  return (
    <motion.div
      {...motionProps}
      className="flex flex-col shrink-0 w-72 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shadow-sm ring-0"
      style={{
        boxShadow: isOver
          ? `0 0 0 2px ${stage.color}50, 0 4px 20px ${stage.color}20`
          : undefined,
        transition: 'box-shadow 150ms ease',
      }}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="font-semibold text-slate-900 text-sm">{stage.label}</span>
        </div>
        <span className="flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold">
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
    </motion.div>
  )
}
