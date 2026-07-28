import { z } from 'zod'

export const workflowTriggerEventTypes = [
  'lead.created',
  'lead.stage_changed',
  'lead.updated',
  'task.completed',
  'email.received'
] as const

export const workflowActionTypes = [
  'create_task',
  'update_lead_stage'
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
  due_offset_days: z.number().int().min(0).optional()
})

export const UpdateLeadStageConfigSchema = z.object({
  stage: z.enum(pipelineStages, {
    required_error: 'Stage is required',
    invalid_type_error: 'Invalid stage selected'
  })
})

export const WorkflowActionSchema = z.discriminatedUnion('action_type', [
  z.object({
    action_type: z.literal('create_task'),
    action_config: CreateTaskConfigSchema
  }),
  z.object({
    action_type: z.literal('update_lead_stage'),
    action_config: UpdateLeadStageConfigSchema
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
