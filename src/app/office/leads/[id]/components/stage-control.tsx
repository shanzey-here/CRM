'use client'

import { useState, useTransition } from 'react'
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
import type { LeadWithContact } from '@/modules/leads/server/repository'
import { LeadQuickActionModals } from '../../components/lead-quick-action-modals'

interface StageControlProps {
  leadId: string
  currentStage: string
  isEditable: boolean
  lead?: LeadWithContact
}

export function StageControl({ leadId, currentStage, isEditable, lead }: StageControlProps) {
  const [isPending, startTransition] = useTransition()
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const currentStageConfig = KANBAN_STAGES.find((s) => s.id === currentStage)

  if (!isEditable || !currentStageConfig) {
    return (
      <Badge style={{ backgroundColor: currentStageConfig?.color, color: 'white' }}>
        {currentStageConfig?.label || currentStage}
      </Badge>
    )
  }

  return (
    <>
      <Select
        value={currentStage}
        onValueChange={(newStage) => {
          if (newStage === 'confirmed_booking' && lead) {
            setShowConfirmModal(true)
            return
          }
          startTransition(async () => {
            await updateLeadStage(leadId, newStage as KanbanStage)
          })
        }}
        disabled={isPending}
      >
        <SelectTrigger className="w-40" data-testid="stage-control-trigger">
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

      {showConfirmModal && lead && (
        <LeadQuickActionModals
          lead={lead}
          activeAction="confirm_booking"
          onClose={() => setShowConfirmModal(false)}
        />
      )}
    </>
  )
}
