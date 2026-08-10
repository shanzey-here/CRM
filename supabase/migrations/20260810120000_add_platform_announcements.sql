-- Platform announcements: Super Admin -> tenant_admin headline banners.
-- SELECT is intentionally scoped to super_admin OR tenant_admin only (not all
-- authenticated users) because RLS is the actual enforcement boundary for both
-- direct queries and the Realtime channel in this project — confirmed via the
-- notifications table's policy + its ALTER PUBLICATION entry.

CREATE TYPE public.announcement_severity_enum AS ENUM ('info', 'warning', 'critical');
CREATE TYPE public.announcement_target_type_enum AS ENUM ('all_tenants', 'specific_tenants', 'by_plan');

CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  severity public.announcement_severity_enum NOT NULL DEFAULT 'info',
  target_type public.announcement_target_type_enum NOT NULL DEFAULT 'all_tenants',
  -- Semantics depend on target_type: tenants.id[] when 'specific_tenants',
  -- saas_plans.id[] when 'by_plan'; empty/ignored when 'all_tenants'.
  target_ids uuid[] NOT NULL DEFAULT '{}',
  dismissible boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX idx_platform_announcements_window ON public.platform_announcements(starts_at, ends_at);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admins_and_tenant_admins_read_announcements" ON public.platform_announcements
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.current_user_role() = 'tenant_admin');

CREATE POLICY "super_admins_manage_announcements" ON public.platform_announcements
  FOR ALL USING (public.is_super_admin() = true) WITH CHECK (public.is_super_admin() = true);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.platform_announcements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER audit_platform_announcements_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.platform_announcements
  FOR EACH ROW EXECUTE FUNCTION audit.log_action();

ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_announcements;

CREATE TABLE public.tenant_announcement_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_announcement_dismissals_unique UNIQUE (announcement_id, user_id)
);

CREATE INDEX idx_dismissals_user ON public.tenant_announcement_dismissals(user_id, announcement_id);

ALTER TABLE public.tenant_announcement_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_dismissals" ON public.tenant_announcement_dismissals
  FOR SELECT USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

-- Only tenant_admin can insert, AND only for an announcement that is actually
-- dismissible — enforced at RLS so a direct API call cannot dismiss a
-- non-dismissible announcement even if it bypasses the Server Action entirely.
CREATE POLICY "tenant_admins_insert_own_dismissals" ON public.tenant_announcement_dismissals
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id = auth.uid()
    AND public.current_user_role() = 'tenant_admin'
    AND EXISTS (
      SELECT 1 FROM public.platform_announcements pa
      WHERE pa.id = announcement_id AND pa.dismissible = true
    )
  );
