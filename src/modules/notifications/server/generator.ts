import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { Database } from '@/types/database.types'

type NotificationType = Database['public']['Enums']['notification_type_enum']
type DomainEventType = Database['public']['Enums']['workflow_trigger_event_type'] | 'task.assigned' // Allow ad-hoc types if they aren't in workflow_trigger_event_type yet

/**
 * Synchronously generates notifications for a given domain event.
 *
 * CRITICAL DESIGN REQUIREMENT: This function must NEVER throw an exception back to
 * the caller. It runs inline during core actions (e.g., lead creation). If notification
 * generation fails, we log it and move on. We must never drop a real domain action
 * just because a notification failed to send.
 */
export async function generateNotifications(
  eventType: string,
  payload: Record<string, any>,
  eventId: string,
  explicitTenantId?: string
) {
  try {
    // 1. Resolve tenant_id.
    const serviceClient = createServiceRoleClient()
    let tenantId = explicitTenantId
    if (!tenantId) {
      // If no explicit tenantId, attempt to derive from payload or fail gracefully.
      // Background workers usually pass explicitTenantId.
      console.warn(`[Notification Engine] No tenant_id provided for event ${eventType} (${eventId}). Skipping notifications.`)
      return
    }

    // 2. Map event to notification rules
    const notificationsToInsert: {
      tenant_id: string
      target_user_id: string
      notification_type: NotificationType
      source_event_id: string | null
      title: string
      message: string
      action_url: string | null
      dedup_key?: string | null
    }[] = []

    if (eventType === 'lead.created') {
      // Broadcast to tenant_admin and dispatcher
      const { data: users, error } = await serviceClient
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('role', ['tenant_admin', 'dispatcher'])

      if (!error && users) {
        for (const user of users) {
          notificationsToInsert.push({
            tenant_id: tenantId,
            target_user_id: user.id,
            notification_type: 'new_lead',
            source_event_id: eventId,
            title: 'New Lead',
            message: `A new lead has been created.`,
            action_url: payload.lead_id ? `/office/leads/${payload.lead_id}` : '/office/leads'
          })
        }
      }
    } else if (eventType === 'quote.accepted') {
      // Broadcast to tenant_admin and dispatcher
      const { data: users, error } = await serviceClient
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('role', ['tenant_admin', 'dispatcher'])

      if (!error && users) {
        for (const user of users) {
          notificationsToInsert.push({
            tenant_id: tenantId,
            target_user_id: user.id,
            notification_type: 'quote_accepted',
            source_event_id: eventId,
            title: 'Quote Accepted',
            message: `A quote has been accepted.`,
            action_url: payload.job_id ? `/office/jobs/${payload.job_id}` : '/office/jobs'
          })
        }
      }
    } else if (eventType === 'task.assigned') {
      // Targeted to specific user
      if (payload.assigned_to) {
        notificationsToInsert.push({
          tenant_id: tenantId,
          target_user_id: payload.assigned_to,
          notification_type: 'task_assigned',
          source_event_id: eventId,
          title: 'New Task Assigned',
          message: payload.title ? `You have been assigned a new task: ${payload.title}` : 'You have been assigned a new task.',
          action_url: '/office/tasks'
        })
      }
    } else if (eventType === 'trial.expiring_soon') {
      // Targeted at all tenant_admin users for this tenant.
      // NOTE: When triggered from the scheduled sweep, notifyApproachingTrials()
      // in src/modules/subscriptions/server/trial-sweep.ts handles the insert
      // directly (with dedup_key idempotency via ON CONFLICT DO NOTHING).
      // This branch exists for completeness / future event-driven invocation.
      const { data: users, error } = await serviceClient
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('role', 'tenant_admin')

      if (!error && users) {
        const daysRemaining = typeof payload.days_remaining === 'number' ? payload.days_remaining : null
        const expiryLabel =
          daysRemaining !== null && daysRemaining <= 0
            ? 'less than a day'
            : daysRemaining !== null
            ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`
            : 'soon'

        for (const user of users) {
          notificationsToInsert.push({
            tenant_id: tenantId,
            target_user_id: user.id,
            notification_type: 'trial_expiring_soon',
            source_event_id: eventId ?? null,
            title: 'Your trial is expiring soon',
            message: `Your free trial expires in ${expiryLabel}. Upgrade now to keep access to all features.`,
            action_url: '/office/settings/billing',
            dedup_key: payload.dedup_key ?? null,
          })
        }
      }
    } else if (eventType === 'error_test') {
      throw new Error('Simulated crash inside generation logic for testing error isolation')
    }

    // 3. Insert notifications safely
    if (notificationsToInsert.length > 0) {
      const { error: insertErr } = await serviceClient
        .from('notifications')
        .insert(notificationsToInsert)

      if (insertErr) {
        console.error(`[Notification Engine] Failed to insert notifications for event ${eventId}:`, insertErr)
      }
    }

  } catch (err: any) {
    // Ultimate safety net: never throw back to the caller
    console.error(`[Notification Engine] Fatal error during notification generation for event ${eventId}:`, err)
  }
}
