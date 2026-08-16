import { z } from 'zod'

export const workflowTriggerEventTypes = [
  'lead.created',
  'lead.stage_changed',
  'lead.updated',
  'task.completed',
  'email.received',
  'email.label_added',
  'quote.sent',
  'quote.accepted',
  'job.completed',
  'invoice.paid'
] as const

export const workflowActionTypes = [
  'create_task',
  'update_lead_stage',
  'delay',
  'send_email',
  'send_sms',
  'notify_staff',
  'condition'
] as const

export const pipelineStages = [
  'inquiry',
  'survey_scheduled',
  'quote_sent',
  'follow_up',
  'confirmed_booking',
  'completed',
  'archived'
] as const

// Triggers
export const ConditionSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  value: z.string().min(1, 'Value is required')
})

// Actions
export const CreateTaskConfigSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assigned_to: z.string().optional(),
  due_offset_days: z.number().int().min(0).optional()
})

export const UpdateLeadStageConfigSchema = z.object({
  stage: z.enum(pipelineStages, {
    required_error: 'Stage is required',
    invalid_type_error: 'Invalid stage selected'
  })
})

export const DelayConfigSchema = z.object({
  delay_hours: z.number().int().min(0).optional().default(0),
  delay_minutes: z.number().int().min(0).optional().default(0)
})

export const ConditionActionConfigSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: z.enum(['===', '>', '<', 'includes']).default('==='),
  value: z.union([z.string(), z.number(), z.boolean()]),
  false_branch_jump_to: z.number().int().optional() // sort_order to jump to if condition is false
})

export const SendEmailConfigSchema = z.object({
  to: z.string().min(1, 'Recipient is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required')
})

export const SendSmsConfigSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  message: z.string().min(1, 'Message is required')
})

export const NotifyStaffConfigSchema = z.object({
  user_id: z.string().min(1, 'Staff member is required'),
  message: z.string().min(1, 'Message is required')
})

export const WorkflowActionSchema = z.discriminatedUnion('action_type', [
  z.object({
    action_type: z.literal('create_task'),
    action_config: CreateTaskConfigSchema
  }),
  z.object({
    action_type: z.literal('update_lead_stage'),
    action_config: UpdateLeadStageConfigSchema
  }),
  z.object({
    action_type: z.literal('delay'),
    action_config: DelayConfigSchema
  }),
  z.object({
    action_type: z.literal('condition'),
    action_config: ConditionActionConfigSchema
  }),
  z.object({
    action_type: z.literal('send_email'),
    action_config: SendEmailConfigSchema
  }),
  z.object({
    action_type: z.literal('send_sms'),
    action_config: SendSmsConfigSchema
  }),
  z.object({
    action_type: z.literal('notify_staff'),
    action_config: NotifyStaffConfigSchema
  })
])

// The main form schema
export const WorkflowFormSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  is_active: z.boolean().default(false),
  trigger_event_type: z.enum(workflowTriggerEventTypes, {
    required_error: 'Trigger event type is required',
    invalid_type_error: 'Invalid trigger event type selected'
  }),
  trigger_conditions: z.array(ConditionSchema).default([]),
  actions: z.array(WorkflowActionSchema).min(1, 'At least one action is required')
})

export type WorkflowFormValues = z.infer<typeof WorkflowFormSchema>
export type WorkflowActionValues = z.infer<typeof WorkflowActionSchema>
