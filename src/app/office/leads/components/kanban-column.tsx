'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, useReducedMotion } from 'framer-motion'
import { GripVertical, MoreHorizontal, Edit2, Trash2 } from 'lucide-react'
import { LeadCard } from './lead-card'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { LeadWithContact } from '@/modules/leads/server/repository'

export interface ColumnDef {
  id: string
  key?: string | null
  label: string
  color: string
  is_system?: boolean
}

interface KanbanColumnProps {
  stage: ColumnDef
  leads: LeadWithContact[]
  isPending: boolean
  index: number
  isDragOverlay?: boolean
  onEditColumn?: (stage: ColumnDef) => void
  onDeleteColumn?: (stage: ColumnDef) => void
}

export function KanbanColumn({
  stage,
  leads,
  isPending,
  index,
  isDragOverlay = false,
  onEditColumn,
  onDeleteColumn,
}: KanbanColumnProps) {
  // Sortable hook for column horizontal reordering
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stage.id,
    data: {
      type: 'Column',
      stage,
    },
    disabled: isDragOverlay,
  })

  // Droppable hook for card drop zone inside this column
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: stage.id })
  const shouldReduceMotion = useReducedMotion()
  const stageColor = stage.color || '#64748b'

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    boxShadow: isOver
      ? `0 0 0 2px ${stageColor}50, 0 4px 20px ${stageColor}20`
      : undefined,
  }

  const motionProps =
    shouldReduceMotion || isDragOverlay
      ? {}
      : {
          initial: { opacity: 0, y: 15 },
          animate: { opacity: isDragging ? 0.35 : 1, y: 0 },
          transition: {
            duration: 0.25,
            delay: index * 0.05,
            ease: [0.25, 0.1, 0.25, 1.0],
          },
        }

  return (
    <motion.div
      ref={setSortableRef}
      {...motionProps}
      className={`flex flex-col shrink-0 w-72 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shadow-sm ring-0 select-none ${
        isDragOverlay ? 'shadow-2xl ring-2 ring-blue-500 rotate-1' : ''
      }`}
      style={style}
      data-testid={`kanban-column-${stage.id}`}
    >
      {/* Column Header — draggable via listeners and attributes */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-between px-3.5 py-3 bg-white border-b border-slate-200 cursor-grab active:cursor-grabbing hover:bg-slate-50/80 transition-colors group"
        data-testid={`column-header-${stage.id}`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stageColor }}
          />
          <span className="font-semibold text-slate-900 text-sm tracking-tight truncate max-w-[130px]">
            {stage.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex items-center justify-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold shrink-0">
            {leads.length}
          </span>

          {!isDragOverlay && (onEditColumn || onDeleteColumn) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
                  aria-label={`Options for ${stage.label}`}
                  data-testid={`column-menu-trigger-${stage.id}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {onEditColumn && (
                  <DropdownMenuItem
                    onClick={() => onEditColumn(stage)}
                    className="cursor-pointer gap-2 text-xs"
                    data-testid={`column-menu-edit-${stage.id}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Rename / Edit</span>
                  </DropdownMenuItem>
                )}
                {onDeleteColumn && !stage.is_system && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDeleteColumn(stage)}
                      className="cursor-pointer gap-2 text-xs text-red-600 focus:text-red-700 focus:bg-red-50"
                      data-testid={`column-menu-delete-${stage.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Column</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Drop zone — droppable node ref for cards */}
      <div
        ref={setDroppableRef}
        className="flex flex-col gap-2 p-2 flex-1 min-h-36 overflow-y-auto bg-slate-100/80 rounded-b-xl"
        style={{
          backgroundColor: isOver ? `${stageColor}08` : undefined,
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
          <div className="flex items-center justify-center h-20 text-xs text-slate-400 italic rounded-lg border-2 border-dashed border-slate-200">
            Drop leads here
          </div>
        )}
      </div>
    </motion.div>
  )
}
