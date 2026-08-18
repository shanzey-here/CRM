-- Email inbox labels (WhatsApp-Business-style). Labels attach to
-- email_threads (the real inbox-row/classification unit — see PR
-- description), not individual email_messages.

CREATE TABLE public.email_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color_hex text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT email_labels_color_hex_format CHECK (color_hex ~* '^#[0-9a-f]{6}$'),
  -- Enables the composite FKs below, matching mailboxes/email_threads' own convention.
  CONSTRAINT email_labels_tenant_unique UNIQUE (id, tenant_id)
);
CREATE UNIQUE INDEX email_labels_tenant_name_unique ON public.email_labels (tenant_id, lower(name));
CREATE UNIQUE INDEX email_labels_tenant_color_unique ON public.email_labels (tenant_id, lower(color_hex));

-- thread_id has a composite FK to (id, tenant_id) on email_threads, not just
-- a plain FK to id. RLS's WITH CHECK only validates this row's OWN tenant_id
-- column — it never verifies the referenced thread actually belongs to that
-- tenant. Without this, an insert with a correct tenant_id but a thread_id
-- from a DIFFERENT tenant would succeed, relying entirely on application
-- code always deriving thread_id from an already-tenant-scoped query. The
-- composite FK makes that unbypassable at the DB level.
--
-- label_id FK has ON DELETE CASCADE: deleting a custom label that's actually
-- assigned to threads cleanly removes its assignments instead of throwing a
-- raw FK-violation.
CREATE TABLE public.email_label_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  label_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  applied_by uuid REFERENCES public.users(id), -- NULL = AI-applied
  applied_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_label_assignments_thread_fk FOREIGN KEY (thread_id, tenant_id) REFERENCES public.email_threads(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT email_label_assignments_label_fk FOREIGN KEY (label_id, tenant_id) REFERENCES public.email_labels(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT email_label_assignments_unique UNIQUE (thread_id, label_id)
);

-- Pending AI suggestions awaiting review at assist/quote_review trust —
-- existence of a row IS the "pending" state, same idiom
-- email_messages.authored_by = 'ai_draft_pending' already uses. Same
-- composite-FK + CASCADE treatment as email_label_assignments above.
CREATE TABLE public.email_label_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL,
  label_id uuid NOT NULL,
  suggested_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  CONSTRAINT email_label_suggestions_thread_fk FOREIGN KEY (thread_id, tenant_id) REFERENCES public.email_threads(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT email_label_suggestions_label_fk FOREIGN KEY (label_id, tenant_id) REFERENCES public.email_labels(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT email_label_suggestions_unique UNIQUE (thread_id, label_id)
);

CREATE INDEX idx_email_label_assignments_thread ON public.email_label_assignments (thread_id);
CREATE INDEX idx_email_label_assignments_tenant ON public.email_label_assignments (tenant_id);
CREATE INDEX idx_email_label_suggestions_tenant ON public.email_label_suggestions (tenant_id);

-- RLS: identical two-policy shape already used by mailboxes/email_threads/email_messages
-- (00044_phase2_email_db.sql) — tenant_admin + dispatcher only, super_admin all.
ALTER TABLE public.email_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_label_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_label_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON public.email_labels FOR ALL
  USING (public.is_super_admin() = true) WITH CHECK (public.is_super_admin() = true);
CREATE POLICY admin_dispatcher_all ON public.email_labels FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'));

CREATE POLICY super_admin_all ON public.email_label_assignments FOR ALL
  USING (public.is_super_admin() = true) WITH CHECK (public.is_super_admin() = true);
CREATE POLICY admin_dispatcher_all ON public.email_label_assignments FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'));

CREATE POLICY super_admin_all ON public.email_label_suggestions FOR ALL
  USING (public.is_super_admin() = true) WITH CHECK (public.is_super_admin() = true);
CREATE POLICY admin_dispatcher_all ON public.email_label_suggestions FOR ALL
  USING (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'))
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_user_role() IN ('tenant_admin', 'dispatcher'));

-- Defaults can't be deleted, even via a direct API call — DB-level, not just
-- a hidden button. The classifier's closed-set prompt depends on these
-- existing.
CREATE OR REPLACE FUNCTION public.prevent_default_label_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_default THEN
    RAISE EXCEPTION 'Cannot delete a default email label';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER prevent_default_label_delete_trigger
  BEFORE DELETE ON public.email_labels
  FOR EACH ROW EXECUTE FUNCTION public.prevent_default_label_delete();
