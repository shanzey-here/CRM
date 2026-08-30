'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  CalendarClock,
  FileText,
  PhoneCall,
  CheckCircle2,
  MapPin,
  Calendar,
  Mail,
  Phone,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import { getContactDisplayName } from './lead-card'
import { KANBAN_STAGES } from '../constants'

import { ScheduleSurveyForm } from './schedule-survey-form'
import { SendQuoteForm } from './send-quote-form'
import { FollowUpForm } from './follow-up-form'
import { ConfirmBookingForm } from './confirm-booking-form'
import type { TenantUser } from '@/modules/users/server/repository'

export type QuickActionType =
  | 'schedule_survey'
  | 'send_quote'
  | 'follow_up'
  | 'confirm_booking'

interface LeadQuickActionModalsProps {
  lead: LeadWithContact
  activeAction: QuickActionType | null
  onClose: () => void
  tenantStaff?: TenantUser[]
}

const ACTION_CONFIG: Record<
  QuickActionType,
  {
    title: string
    shortTitle: string
    epic: string
    icon: React.ComponentType<{ className?: string }>
    iconBg: string
    iconColor: string
    targetStageLabel: string
    targetStageColor: string
    processExplanation: string
    actionButtonText: string
  }
> = {
  schedule_survey: {
    title: 'Schedule Survey',
    shortTitle: 'Survey',
    epic: 'Epic D',
    icon: CalendarClock,
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    iconColor: 'text-emerald-600',
    targetStageLabel: 'Survey Scheduled',
    targetStageColor: '#64748b',
    processExplanation:
      'This process action books an appointment on the unified calendar, assigns a surveyor, and automatically transitions the lead stage to Survey Scheduled upon completion.',
    actionButtonText: 'Schedule Survey Appointment',
  },
  send_quote: {
    title: 'Send Quote Proposal',
    shortTitle: 'Quote',
    epic: 'Epic E',
    icon: FileText,
    iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
    iconColor: 'text-blue-600',
    targetStageLabel: 'Quote Sent',
    targetStageColor: '#3b82f6',
    processExplanation:
      'This process action creates or compiles a quote proposal, generates the secure customer link, and automatically transitions the lead stage to Quote Sent upon completion.',
    actionButtonText: 'Send Quote Proposal',
  },
  follow_up: {
    title: 'Log Follow-Up',
    shortTitle: 'Follow-Up',
    epic: 'Epic F',
    icon: PhoneCall,
    iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
    iconColor: 'text-amber-600',
    targetStageLabel: 'Follow Up',
    targetStageColor: '#f59e0b',
    processExplanation:
      'This process action logs communication notes, schedules reminder tasks on the dashboard, and automatically transitions the lead stage to Follow Up upon completion.',
    actionButtonText: 'Log Follow-Up & Reminder',
  },
  confirm_booking: {
    title: 'Confirm Booking',
    shortTitle: 'Booking',
    epic: 'Epic G',
    icon: CheckCircle2,
    iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    iconColor: 'text-indigo-600',
    targetStageLabel: 'Confirmed Booking',
    targetStageColor: '#10b981',
    processExplanation:
      'For a booking closed outside the online proposal flow. This process action creates a real operational job and a draft invoice (the same path as the New Job page), then transitions the lead stage to Confirmed Booking. Crew, vehicles and scheduling times are added afterwards on the job.',
    actionButtonText: 'Confirm Booking & Create Job',
  },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function LeadQuickActionModals({
  lead,
  activeAction,
  onClose,
  tenantStaff,
}: LeadQuickActionModalsProps) {
  if (!activeAction) return null

  const config = ACTION_CONFIG[activeAction]
  const IconComponent = config.icon
  const contactName = getContactDisplayName(lead.contact)
  const contact = Array.isArray(lead.contact) ? lead.contact[0] : lead.contact
  const currentStageConfig = KANBAN_STAGES.find((s) => s.id === lead.stage)

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="max-w-lg p-6 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader className="gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${config.iconBg}`}
              >
                <IconComponent className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    {config.title}
                  </DialogTitle>
                  <Badge variant="outline" className="text-[11px] font-semibold text-slate-600 bg-slate-100">
                    {config.epic}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Quick process action for <span className="font-semibold text-slate-700">{contactName}</span>
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Process Indicator Banner (Clear distinction from raw stage override) */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-blue-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-blue-950">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>Real Process Trigger</span>
            <span className="text-blue-400">·</span>
            <span className="font-normal text-blue-800">
              Not a raw stage override
            </span>
          </div>
          <p className="text-blue-800/90 leading-relaxed">
            {config.processExplanation}
          </p>
          <div className="flex items-center gap-2 pt-1 text-[11px]">
            <span className="text-slate-500 font-medium">Stage transition:</span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              {currentStageConfig?.label || lead.stage}
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span style={{ color: config.targetStageColor }}>
                {config.targetStageLabel}
              </span>
            </span>
          </div>
        </div>

        {/* Lead Context Summary Box */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5 text-xs">
          <div className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
            Lead Summary
          </div>
          <div className="grid grid-cols-2 gap-3 text-slate-600">
            <div>
              <span className="text-slate-400 block text-[11px]">Contact</span>
              <span className="font-medium text-slate-800 truncate block">
                {contactName}
              </span>
              {contact?.phone && (
                <span className="text-slate-500 flex items-center gap-1 mt-0.5 text-[11px]">
                  <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                  {contact.phone}
                </span>
              )}
              {contact?.email && (
                <span className="text-slate-500 flex items-center gap-1 mt-0.5 text-[11px] truncate">
                  <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                  {contact.email}
                </span>
              )}
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Move Date</span>
              <span className="font-medium text-slate-800 flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0 text-slate-400" />
                {formatDate(lead.preferred_move_date)}
              </span>
              <span className="text-slate-400 block text-[11px] mt-1.5">Route</span>
              <span className="text-slate-600 flex items-center gap-1 text-[11px]">
                <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                Origin → Destination TBC
              </span>
            </div>
          </div>
        </div>

        {/* Action Body: Real Schedule Survey (Epic D), Send Quote (Epic E),
            Log Follow-Up (Epic F), Confirm Booking (Epic G) */}
        {activeAction === 'schedule_survey' ? (
          <ScheduleSurveyForm
            lead={lead}
            tenantStaff={tenantStaff}
            onSuccess={onClose}
            onCancel={onClose}
          />
        ) : activeAction === 'send_quote' ? (
          <SendQuoteForm
            lead={lead}
            onSuccess={onClose}
            onCancel={onClose}
          />
        ) : activeAction === 'follow_up' ? (
          <FollowUpForm
            lead={lead}
            onSuccess={onClose}
            onCancel={onClose}
          />
        ) : (
          <ConfirmBookingForm
            lead={lead}
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
