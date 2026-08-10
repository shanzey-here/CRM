-- Seed the 8 default email labels for every tenant: new tenants via the
-- real live provisioning trigger (provision_tenant_defaults(), confirmed in
-- 00040_fix_trial_provisioning_on_actual_trigger.sql to be the one that
-- actually fires AFTER INSERT ON tenants — NOT the dead handle_new_tenant()
-- sibling), and existing tenants via a one-off backfill below.

CREATE OR REPLACE FUNCTION public.provision_tenant_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default tenant_settings
  INSERT INTO public.tenant_settings (tenant_id, primary_color, address_country)
  VALUES (NEW.id, '#1a56db', 'GB')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Insert default pricing_settings with minimum positive rates
  INSERT INTO public.pricing_settings (
    tenant_id,
    base_rate,
    per_mile_rate,
    per_cubic_foot_rate,
    labor_hourly_rate,
    labour_hours_per_cubicft
  )
  VALUES (NEW.id, 100, 1, 0.5, 25, 0.1)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Auto-provision 14-day trial subscription
  INSERT INTO public.tenant_subscriptions (tenant_id, status, current_period_end)
  VALUES (NEW.id, 'trialing', now() + interval '14 days')
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Auto-provision the 8 default email labels
  INSERT INTO public.email_labels (tenant_id, name, color_hex, is_default)
  VALUES
    (NEW.id, 'New Lead', '#3B82F6', true),
    (NEW.id, 'Quote Requested', '#8B5CF6', true),
    (NEW.id, 'Awaiting Reply', '#F59E0B', true),
    (NEW.id, 'Booking Confirmed', '#14B8A6', true),
    (NEW.id, 'Payment Pending', '#F97316', true),
    (NEW.id, 'Paid', '#22C55E', true),
    (NEW.id, 'Job Completed', '#EC4899', true),
    (NEW.id, 'Complaint / Urgent', '#DC2626', true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill: the trigger above only fires on new tenant creation, so
-- existing tenants need the same 8 defaults inserted directly, once.
INSERT INTO public.email_labels (tenant_id, name, color_hex, is_default)
SELECT t.id, d.name, d.color_hex, true
FROM public.tenants t
CROSS JOIN (VALUES
  ('New Lead', '#3B82F6'),
  ('Quote Requested', '#8B5CF6'),
  ('Awaiting Reply', '#F59E0B'),
  ('Booking Confirmed', '#14B8A6'),
  ('Payment Pending', '#F97316'),
  ('Paid', '#22C55E'),
  ('Job Completed', '#EC4899'),
  ('Complaint / Urgent', '#DC2626')
) AS d(name, color_hex)
ON CONFLICT DO NOTHING;
