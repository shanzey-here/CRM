-- =============================================================================
-- 00008_phase1_activities_tasks.sql
-- Activities (immutable timelines) and Tasks (actionable items) schema
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM ('note', 'call', 'email', 'stage_change', 'system');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ACTIVITIES TABLE
-- An immutable log of events, except for 'note' types which authors can edit.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id  uuid,
  lead_id     uuid,
  type        activity_type NOT NULL,
  content     text NOT NULL,
  metadata    jsonb,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  edited_at   timestamptz,
  
  -- Prevent orphaned activities
  CONSTRAINT chk_activity_has_target CHECK (contact_id IS NOT NULL OR lead_id IS NOT NULL),
  
  -- Composite FKs enforce tenant scoping correctly
  CONSTRAINT fk_activity_contact FOREIGN KEY (contact_id, tenant_id) REFERENCES contacts(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_lead FOREIGN KEY (lead_id, tenant_id) REFERENCES leads(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_activities_tenant ON activities(tenant_id);
CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_activities_lead ON activities(lead_id);
CREATE INDEX idx_activities_created_at ON activities(created_at);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON activities FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

-- Everyone in the tenant can read activities
CREATE POLICY tenant_staff_select ON activities FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher', 'crew')
  );

-- Admins and dispatchers can insert activities
CREATE POLICY admin_dispatcher_insert ON activities FOR INSERT
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- Only authors can update their notes
CREATE POLICY admin_dispatcher_update ON activities FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
    AND type = 'note'
    AND created_by = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
    AND type = 'note'
    AND created_by = auth.uid()
  );

-- Trigger to enforce immutability of non-notes and prevent changing core fields
CREATE OR REPLACE FUNCTION check_activity_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.type != 'note' THEN
    RAISE EXCEPTION 'Only notes can be edited';
  END IF;

  IF NEW.id != OLD.id OR NEW.tenant_id != OLD.tenant_id OR NEW.contact_id IS DISTINCT FROM OLD.contact_id OR NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.type != OLD.type OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'Cannot modify core activity fields, only content and metadata';
  END IF;

  NEW.edited_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_activity_update
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION check_activity_update();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TASKS TABLE
-- Actionable items assigned to users.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id    uuid,
  lead_id       uuid,
  assigned_to   uuid REFERENCES users(id) ON DELETE SET NULL,
  title         text NOT NULL,
  description   text,
  due_date      timestamptz,
  status        task_status NOT NULL DEFAULT 'pending',
  priority      task_priority NOT NULL DEFAULT 'medium',
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,
  completed_at  timestamptz,
  completed_by  uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Prevent orphaned tasks
  CONSTRAINT chk_task_has_target CHECK (contact_id IS NOT NULL OR lead_id IS NOT NULL),
  
  -- Composite FKs enforce tenant scoping correctly
  CONSTRAINT fk_task_contact FOREIGN KEY (contact_id, tenant_id) REFERENCES contacts(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_task_lead FOREIGN KEY (lead_id, tenant_id) REFERENCES leads(id, tenant_id) ON DELETE CASCADE,
  -- Crew assignment is tenant scoped
  CONSTRAINT fk_task_assignee FOREIGN KEY (assigned_to, tenant_id) REFERENCES users(id, tenant_id)
);

CREATE INDEX idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX idx_tasks_contact ON tasks(contact_id);
CREATE INDEX idx_tasks_lead ON tasks(lead_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

CREATE POLICY super_admin_all ON tasks FOR ALL
  USING (public.is_super_admin() = true)
  WITH CHECK (public.is_super_admin() = true);

-- Admins and dispatchers have full CRUD on tenant tasks
CREATE POLICY admin_dispatcher_all ON tasks FOR ALL
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() IN ('tenant_admin', 'dispatcher')
  );

-- Crew can select tasks assigned to them
CREATE POLICY crew_select ON tasks FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() = 'crew'
    AND assigned_to = auth.uid()
  );

-- Crew can update their assigned tasks
CREATE POLICY crew_update ON tasks FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() = 'crew'
    AND assigned_to = auth.uid()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.current_user_role() = 'crew'
    AND assigned_to = auth.uid()
  );

-- Trigger to prevent crew from modifying anything other than status/completion fields
CREATE OR REPLACE FUNCTION restrict_crew_task_update()
RETURNS TRIGGER AS $$
BEGIN
  IF public.current_user_role() = 'crew' THEN
    IF NEW.id != OLD.id OR NEW.tenant_id != OLD.tenant_id OR NEW.contact_id IS DISTINCT FROM OLD.contact_id OR NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.title != OLD.title OR NEW.description IS DISTINCT FROM OLD.description OR NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.priority != OLD.priority OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at != OLD.created_at THEN
      RAISE EXCEPTION 'Crew role can only update task status and completion fields';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restrict_crew_task_update
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION restrict_crew_task_update();

-- Auto set updated_at on insert if needed? Or just let it be null until first update. Usually null until update is fine.
