import { WorkflowFormValues } from './schemas'

export interface WorkflowTemplate {
  id: string
  title: string
  description: string
  icon: string
  color: string
  config: WorkflowFormValues
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'new_lead_followup',
    title: 'New Lead Follow-up',
    description: 'When a new lead comes in from the website, create a follow-up task for tomorrow.',
    icon: 'UserPlus',
    color: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    config: {
      name: 'New Lead Follow-up',
      is_active: false, // Enforced inactive by default
      trigger_event_type: 'lead.created',
      trigger_conditions: [],
      actions: [
        {
          action_type: 'create_task',
          action_config: {
            title: 'Follow up with new lead',
            description: 'This is an automated task generated for a new inbound lead.',
            due_offset_days: 1
          }
        }
      ]
    }
  },
  {
    id: 'quote_sent_followup',
    title: 'Quote Sent Follow-up',
    description: 'When a lead is moved to Quote Sent, automatically create a follow-up task in 3 days.',
    icon: 'FileText',
    color: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    config: {
      name: 'Quote Sent Follow-up',
      is_active: false,
      trigger_event_type: 'lead.stage_changed',
      trigger_conditions: [
        { field: 'new_stage', value: 'quote_sent' }
      ],
      actions: [
        {
          action_type: 'create_task',
          action_config: {
            title: 'Follow up on sent quote',
            description: 'Check in with the customer to see if they have any questions about the quote.',
            due_offset_days: 3
          }
        }
      ]
    }
  },
  {
    id: 'completed_job_review',
    title: 'Completed Lead Review',
    description: 'When a lead is moved to Completed, create a task to ask the customer for a review.',
    icon: 'Star',
    color: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    config: {
      name: 'Completed Lead Review',
      is_active: false,
      trigger_event_type: 'lead.stage_changed',
      trigger_conditions: [
        { field: 'new_stage', value: 'completed' }
      ],
      actions: [
        {
          action_type: 'create_task',
          action_config: {
            title: 'Follow up for customer review',
            description: 'The job is complete. Reach out to the customer and ask for a review.',
            due_offset_days: 2
          }
        }
      ]
    }
  }
]
