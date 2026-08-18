-- Real bug found during invoice-editor-ui testing: a customer viewing their
-- own real invoice via a real authenticated RLS-scoped session (not the
-- service-role client the pre-existing public-token proposal page uses)
-- could not read either invoice_templates or tenant_settings — neither
-- table had a customer_select policy, since nothing customer-facing had
-- ever needed one before this branch. Both are read-only, tenant-scoped,
-- and contain only presentation/branding config (never financial figures)
-- — a customer can only ever see their own tenant's copy, exactly what's
-- needed to render their own invoice correctly. Write access is unchanged
-- (still tenant_admin/dispatcher only on both tables).

CREATE POLICY customer_select ON invoice_templates FOR SELECT
  USING (
    public.current_user_role() = 'customer'
    AND tenant_id = public.current_tenant_id()
  );

CREATE POLICY customer_select ON tenant_settings FOR SELECT
  USING (
    public.current_user_role() = 'customer'
    AND tenant_id = public.current_tenant_id()
  );
