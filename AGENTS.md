# AGENTS.md — Removals & Storage CRM Platform

Multi-tenant B2B SaaS ("operations platform") for UK removals & storage companies. A feature-clone-plus of i-mve, built to keep growing. Read this before every task.

## Tech stack
- **Database & backend:** Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions). EU region.
- **Web:** Next.js (App Router) + TypeScript (strict).
- **Background work:** a queue + worker service for async jobs (external APIs, AI email, notifications).
- **Mobile (later):** React Native + Expo. Not in scope until Phase 2.
- **Payments:** Stripe (Connect for tenant payouts; subscriptions for our own SaaS billing).
- **Integrations (Phase 2 only):** Google Maps, WhatsApp Business API, social-media publishing, Xero/QuickBooks.

## Architecture principles (non-negotiable)
- **Multi-tenant.** Every tenant (removals company) is fully isolated. Every tenant-scoped table has `tenant_id`.
- **RLS-first.** Row-Level Security is enabled on every tenant table from its first migration — never added later.
- **Two admin layers:** a *platform super-admin* (crosses tenants, for us) is a separate concept from *tenant roles* (`tenant_admin`, `dispatcher`, `crew`, `customer`) which never cross tenants.
- **No cross-tenant foreign keys.** A child row's `tenant_id` must equal its parent's.

## Architecture: modular & extensible (non-negotiable)
This is a **modular monolith**: one deployable app, split internally into self-contained modules (clients, quoting, jobs, scheduling, invoicing, messaging, social, automation, …). Build for fault isolation and future growth:
- **Each module owns its own tables, code folder, and API surface.** A module NEVER reads or writes another module's tables directly.
- **Modules communicate through defined service interfaces and domain events** (an outbox/`domain_events` table), not by reaching into each other's internals. A failure or change in one module must stay contained.
- **External-dependent work runs as async background jobs via the queue** (social posting, WhatsApp, AI email, Maps, accounting). A third-party outage fails inside the job and never breaks the request path.
- **Degrade gracefully.** The UI loads each module's data independently — a broken widget shows its own error; the rest of the page still works. No single all-or-nothing mega-query.
- **Module enablement is a per-tenant feature flag** (`tenant_modules`), so modules can be toggled on/off without a redeploy and tenants can opt in.
- **The shared foundation (database, auth, tenant boundary, event bus) is deliberately NOT modular** — it is the common substrate, hardened rather than split.
- **Extensibility rule:** new features arrive as NEW modules that plug into the event stream and the module registry, without refactoring existing modules. Prefer additive changes over editing shared code.

## Safety guardrails (auto-continue is on — these are hard stops)
- NEVER weaken, disable, or skip RLS or tenant isolation to make something work. If isolation blocks a feature, stop and ask.
- NEVER write malware, and NEVER hardcode secrets/keys. Secrets come from environment variables only.
- NEVER expose the Supabase `service_role` key to any client-side code.
- Handle all card/payment logic server-side via the Stripe SDK — card data never touches our database.
- Before destructive DB operations or migrations against real data, pause and ask for explicit confirmation.
- Any change touching the database, auth, or tenant boundary triggers the **tenant-isolation** skill — follow it.

## Code conventions
- TypeScript strict everywhere; no `any` without a written reason.
- One feature/module per folder; keep modules self-contained. Repository pattern for DB access.
- UUID primary keys; `created_at`/`updated_at` on every table; money as `numeric(12,2)`.
- Prefer clarity over cleverness. Small, reviewable changes over large ones.

## Build discipline
- **Stay in the current phase.** We build **Phase 1 core** first: clients, lead intake + pipeline, quoting chain, jobs, scheduling calendar, invoicing + payments, dashboard, settings. Do NOT build Phase 2 features (WhatsApp, shared inbox, AI email, social media, automation workflows, crates, storage, analytics) unless explicitly told.
- New modules follow the `/new-module` workflow — own tables, own events, no reaching into other modules.
- Use **Planning mode** for any new module — produce the plan and wait for review before writing code.
- After building UI, self-verify it in the browser.

## When unsure
State a reasonable assumption and proceed; collect genuinely load-bearing decisions in a short list for me to confirm. Don't stall on small ambiguities, don't guess on security ones.
