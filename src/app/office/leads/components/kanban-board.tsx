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
  closestCenter,
  closestCorners,
  pointerWithin,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { useState, useTransition, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { KanbanColumn } from './kanban-column'
import { LeadCard } from './lead-card'
import { AddColumnDialog } from './add-column-dialog'
import { updateLeadStage, reorderPipelineStagesAction } from '../actions'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import type { PipelineStageDef } from '@/modules/leads/schemas'

interface KanbanBoardProps {
  initialStages: PipelineStageDef[]
  initialLeads: LeadWithContact[]
}

export function KanbanBoard({ initialStages, initialLeads }: KanbanBoardProps) {
  // Local state for dynamic stages and leads
  const [stages, setStages] = useState<PipelineStageDef[]>(initialStages)
  const [leads, setLeads] = useState<LeadWithContact[]>(initialLeads)
  const [activeColumn, setActiveColumn] = useState<PipelineStageDef | null>(null)
  const [activeLead, setActiveLead] = useState<LeadWithContact | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require 8px movement before dragging — prevents accidental clicks
        distance: 8,
      },
    })
  )

  const stageIds = stages.map((s) => s.id)

  const customCollisionDetection: CollisionDetection = useCallback(
    (args) => {
      // Column dragging: strictly detect nearest column center
      if (args.active.data.current?.type === 'Column') {
        const columnContainers = args.droppableContainers.filter((c) =>
          stageIds.includes(c.id as string)
        )
        return closestCenter({
          ...args,
          droppableContainers: columnContainers,
        })
      }

      // Card dragging: prefer pointerWithin for drop targets
      const pointerCollisions = pointerWithin(args)
      if (pointerCollisions.length > 0) {
        const columnCollision = pointerCollisions.find((c) =>
          stageIds.includes(c.id as string)
        )
        return columnCollision ? [columnCollision] : [pointerCollisions[0]]
      }
      return closestCorners(args)
    },
    [stageIds]
  )

  const leadsByStage = useCallback(
    (stage: PipelineStageDef) =>
      leads.filter(
        (l) => l.stage_id === stage.id || (stage.key && l.stage === stage.key)
      ),
    [leads]
  )

  function handleDragStart(event: DragStartEvent) {
    setError(null)
    const activeData = event.active.data.current

    if (activeData?.type === 'Column') {
      const col = stages.find((s) => s.id === event.active.id) ?? activeData.stage
      setActiveColumn(col)
      setActiveLead(null)
    } else {
      const lead = leads.find((l) => l.id === event.active.id)
      setActiveLead(lead ?? null)
      setActiveColumn(null)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveColumn(null)
    setActiveLead(null)

    if (!over) return

    // ──────────────────────────────────────────────────────────────────────────
    // 1. COLUMN DRAG & DROP REORDERING
    // ──────────────────────────────────────────────────────────────────────────
    if (active.data.current?.type === 'Column') {
      const activeStageId = active.id as string
      const overStageId = over.id as string

      if (activeStageId === overStageId) return

      const oldIndex = stages.findIndex((s) => s.id === activeStageId)
      const newIndex = stages.findIndex((s) => s.id === overStageId)

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      const previousStages = stages
      const newStages = arrayMove(stages, oldIndex, newIndex)
      setStages(newStages)

      startTransition(async () => {
        const orderedIds = newStages.map((s) => s.id)
        const result = await reorderPipelineStagesAction(orderedIds)
        if (!result.success) {
          // ROLLBACK: restore previous stage order
          setStages(previousStages)
          setError(result.error || 'Failed to reorder columns. Changes reverted.')
        }
      })
      return
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. LEAD CARD DRAG & DROP STAGE TRANSITION
    // ──────────────────────────────────────────────────────────────────────────
    const leadId = active.id as string
    let targetStageId: string | null = null

    // Determine target stage from dropped container
    if (over.data.current?.type === 'Column' || stageIds.includes(over.id as string)) {
      targetStageId = over.id as string
    } else if (over.data.current?.type === 'Card') {
      const overLead = leads.find((l) => l.id === over.id)
      targetStageId = overLead?.stage_id ?? null
    } else {
      const matchedStage = stages.find((s) => s.id === over.id || s.key === over.id)
      targetStageId = matchedStage?.id ?? null
    }

    if (!targetStageId) return

    const currentLead = leads.find((l) => l.id === leadId)
    if (!currentLead) return

    const targetStage = stages.find(
      (s) => s.id === targetStageId || (s.key && s.key === targetStageId)
    )
    if (!targetStage) return

    // Don't transition if already in this stage
    if (
      currentLead.stage_id === targetStage.id ||
      (targetStage.key && currentLead.stage === targetStage.key)
    ) {
      return
    }

    // Optimistic update — move the card immediately in local state
    const previousLeads = leads
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage_id: targetStage.id,
              stage: (targetStage.key as any) ?? null,
            }
          : l
      )
    )

    // Server Action — if it fails, roll back to previousLeads and show error
    startTransition(async () => {
      const result = await updateLeadStage(leadId, targetStage.id)
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
          className="mx-6 flex items-center justify-between gap-3 px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg"
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
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 pl-6 pr-6 flex-1 items-start">
          <SortableContext items={stageIds} strategy={horizontalListSortingStrategy}>
            {stages.map((stage, index) => (
              <KanbanColumn
                key={stage.id}
                stage={{
                  id: stage.id,
                  key: stage.key,
                  label: stage.name,
                  color: stage.color || '#64748b',
                }}
                leads={leadsByStage(stage)}
                isPending={isPending}
                index={index}
              />
            ))}
          </SortableContext>

          {/* "+ Add column" Trigger Card */}
          <div className="shrink-0 w-72 flex flex-col">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 p-4 text-sm font-semibold text-slate-600 bg-white/70 hover:bg-white border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl transition-all h-24 shadow-sm hover:shadow group"
              data-testid="add-column-button"
            >
              <span className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                <Plus className="w-4 h-4" />
              </span>
              <span>Add column</span>
            </button>
          </div>
        </div>

        {/* DragOverlay renders a floating ghost for either column or card */}
        <DragOverlay>
          {activeColumn ? (
            <KanbanColumn
              stage={{
                id: activeColumn.id,
                key: activeColumn.key,
                label: activeColumn.name,
                color: activeColumn.color || '#64748b',
              }}
              leads={leadsByStage(activeColumn)}
              isPending={isPending}
              index={0}
              isDragOverlay
            />
          ) : activeLead ? (
            <LeadCard lead={activeLead} isDragOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add Column Modal Dialog */}
      <AddColumnDialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onColumnCreated={(newStage) => {
          setStages((prev) => [...prev, newStage])
        }}
      />
    </div>
  )
}
