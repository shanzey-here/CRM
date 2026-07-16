'use client'

import { useTransition } from 'react'
import { updateLeadStage } from '../../actions'
import { KANBAN_STAGES } from '../../constants'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { KanbanStage } from '../../actions'

interface StageControlProps {
  leadId: string
  currentStage: string
  isEditable: boolean
}

export function StageControl({ leadId, currentStage, isEditable }: StageControlProps) {
  const [isPending, startTransition] = useTransition()
  const currentStageConfig = KANBAN_STAGES.find((s) => s.id === currentStage)

  if (!isEditable || !currentStageConfig) {
    return (
      <Badge style={{ backgroundColor: currentStageConfig?.color, color: 'white' }}>
        {currentStageConfig?.label || currentStage}
      </Badge>
    )
  }

  return (
    <Select
      value={currentStage}
      onValueChange={(newStage) => {
        startTransition(async () => {
          await updateLeadStage(leadId, newStage as KanbanStage)
        })
      }}
      disabled={isPending}
    >
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {KANBAN_STAGES.map((stage) => (
          <SelectItem key={stage.id} value={stage.id}>
            {stage.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
