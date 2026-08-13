-- Multi-theme support (internal /office staff dashboard only — the
-- customer-facing branded pages use tenant_settings.primary_color, a
-- separate, already-existing system this column does not touch).
-- Tenant-level, not per-user: one admin choice applies to everyone at that
-- tenant, matching how tenant_settings already stores one row per tenant.
CREATE TYPE public.ui_theme AS ENUM ('default', 'dark');

ALTER TABLE public.tenant_settings
  ADD COLUMN ui_theme public.ui_theme NOT NULL DEFAULT 'default';
