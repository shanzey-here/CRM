-- 00075_phase2_notifications_db.sql

CREATE TYPE public.notification_type_enum AS ENUM ('new_lead', 'quote_accepted', 'task_assigned');

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type notification_type_enum NOT NULL,
  source_event_id uuid REFERENCES public.domain_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indices for fast querying
CREATE INDEX idx_notifications_tenant_user_created ON public.notifications(tenant_id, target_user_id, created_at DESC);
CREATE INDEX idx_notifications_tenant_user_unread ON public.notifications(tenant_id, target_user_id) WHERE read_at IS NULL;

-- RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "users_read_own_notifications" 
  ON public.notifications FOR SELECT 
  USING (tenant_id = public.current_tenant_id() AND target_user_id = auth.uid());

-- Users can update their own notifications (e.g., to mark as read)
CREATE POLICY "users_update_own_notifications" 
  ON public.notifications FOR UPDATE 
  USING (tenant_id = public.current_tenant_id() AND target_user_id = auth.uid()) 
  WITH CHECK (tenant_id = public.current_tenant_id() AND target_user_id = auth.uid());

-- Note: INSERT is handled strictly by the service_role in generateNotifications(), 
-- ensuring that unauthenticated users (e.g., lead form submitters) or customers 
-- can still trigger notifications for admins without needing broad INSERT grants.
