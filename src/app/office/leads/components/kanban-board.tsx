'use client'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
  closestCorners,
  pointerWithin,
} from '@dnd-kit/core'
import { useState, useTransition, useCallback } from 'react'
import { KanbanColumn } from './kanban-column'
import { LeadCard } from './lead-card'
import { updateLeadStage, type KanbanStage } from '../actions'
import { KANBAN_STAGES } from '../constants'
import type { LeadWithContact } from '@/modules/leads/server/repository'

interface KanbanBoardProps {
  initialLeads: LeadWithContact[]
}

// Every LeadCard is also its own droppable (useSortable registers a droppable
// keyed by the card's id, alongside each column's useDroppable keyed by stage
// id). closestCorners alone can resolve to a card's rect instead of its
// parent column's, so handleDragEnd's over.id ends up being a lead UUID
// rather than a valid stage — silently rejected, card snaps back. Try
// pointerWithin first and prefer a real column id when one is among the
// results; only fall back to closestCorners if the pointer isn't within any
// registered droppable at all.
const STAGE_IDS = KANBAN_STAGES.map((s) => s.id) as string[]

const columnAwareCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) {
    const columnCollision = pointerCollisions.find((c) => STAGE_IDS.includes(c.id as string))
    return columnCollision ? [columnCollision] : [pointerCollisions[0]]
  }
  return closestCorners(args)
}

export function KanbanBoard({ initialLeads }: KanbanBoardProps) {
  // Local optimistic state — mutated instantly on drag, rolled back on failure
  const [leads, setLeads] = useState<LeadWithContact[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require 8px movement before dragging — prevents accidental drags on clicks
        distance: 8,
      },
    })
  )

  const leadsByStage = useCallback(
    (stage: KanbanStage) => leads.filter((l) => l.stage === stage),
    [leads]
  )

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
    setError(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event

    if (!over) return

    const leadId = active.id as string
    const newStage = over.id as KanbanStage

    const currentLead = leads.find((l) => l.id === leadId)
    if (!currentLead || currentLead.stage === newStage) return

    // Validate new stage is a recognised kanban stage before optimistic update
    const validStages = KANBAN_STAGES.map((s) => s.id)
    if (!validStages.includes(newStage)) return

    // Optimistic update — move the card immediately in local state
    const previousLeads = leads
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    )

    // Server Action — if it fails, roll back to previousLeads and show error
    startTransition(async () => {
      const result = await updateLeadStage(leadId, newStage)
      if (!result.success) {
        // ROLLBACK: restore the card to where it was before the drag
        setLeads(previousLeads)
        setError(result.error ?? 'Failed to update stage. Changes reverted.')
      }
    })
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Error banner — shows only after a failed Server Action, auto-dismissable */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg"
        >
          <span>⚠ {error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-medium shrink-0"
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      <DndContext
        id="kanban-board-dnd-context"
        sensors={sensors}
        collisionDetection={columnAwareCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 pl-6 flex-1 after:content-[''] after:w-6 after:shrink-0">
          {KANBAN_STAGES.map((stage, index) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage(stage.id as KanbanStage)}
              isPending={isPending}
              index={index}
            />
          ))}
        </div>

        {/* DragOverlay renders a floating ghost card while dragging */}
        <DragOverlay>
          {activeLead ? (
            <LeadCard lead={activeLead} isDragOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
