DO $$
DECLARE
  v_tenant_id uuid;
  v_log_record audit.logs%ROWTYPE;
BEGIN
  -- Clean up first if it exists
  DELETE FROM public.tenants WHERE slug = 'test-ui-slug';
  
  -- Insert a test tenant (simulate UI creation)
  INSERT INTO public.tenants (name, slug, status)
  VALUES ('UI Test Tenant', 'test-ui-slug', 'active')
  RETURNING id INTO v_tenant_id;

  -- Fetch the audit log generated
  SELECT * INTO v_log_record FROM audit.logs 
  WHERE table_name = 'tenants' AND action = 'INSERT' AND tenant_id = v_tenant_id
  ORDER BY created_at DESC LIMIT 1;

  -- Verify content
  IF v_log_record.new_data->>'name' = 'UI Test Tenant' AND v_log_record.new_data->>'slug' = 'test-ui-slug' THEN
    RAISE NOTICE 'PASS: Audit log correctly captured the exact new_data content!';
  ELSE
    RAISE WARNING 'FAIL: Audit log content mismatch: %', v_log_record.new_data;
  END IF;

  -- Clean up
  DELETE FROM public.tenants WHERE id = v_tenant_id;
  DELETE FROM audit.logs WHERE tenant_id = v_tenant_id;

END $$;
