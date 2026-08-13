# Multi-Theme Support Implementation Summary
## feature/phase3-multi-theme-support — COMPLETE (mechanism + highest-impact surfaces) ✓

### Overview

Adds tenant-level theming (Default / Dark) to the internal `/office` staff dashboard only. The customer-facing branded pages (`tenant_settings.primary_color`, used by `office/settings/branding` and the public `/proposal/[token]` page) are a separate, pre-existing system and were not touched.

Scope, decided explicitly after a Part 1 audit: build the real mechanism end-to-end (DB column, `.dark` class activation, theme picker, dark-mode-validated palette choices) and convert the root layout, nav, dashboard home, reports, and the two real in-scope "chart-like" components (`ConversionFunnel`, `RepeatCustomersList`) — the surfaces covering most staff-facing screen time. The remaining ~100 files across the rest of `/office` still use hardcoded Tailwind color classes and will render with light-mode colors even when Dark is selected. This file is the itemized record of exactly what remains, per the condition attached to that scope decision.

### Files Delivered

#### Database Migration
- `supabase/migrations/20260813140000_add_tenant_ui_theme.sql` — `public.ui_theme` enum (`'default' | 'dark'`), `tenant_settings.ui_theme` column, `NOT NULL DEFAULT 'default'`.

#### Mechanism
- `src/app/office/layout.tsx` — reads `tenant_settings.ui_theme`, wraps the entire `/office` render tree in a `.dark` class when set. This is the single activation point every `/office` page inherits from.
- `src/modules/settings/theme/schemas.ts` — `uiThemeSchema` (Zod).
- `src/app/office/settings/appearance/actions.ts` — `updateUiThemeAction`, same auth/tenant/role pattern as `updateBrandingAction`.
- `src/app/office/settings/appearance/components/theme-picker.tsx` — client picker with live, accurately-scoped `.dark` preview swatches (not hand-approximated colors).
- `src/app/office/settings/appearance/page.tsx` — settings page, linked from `settings/layout.tsx` nav.

#### Converted Surfaces
- `src/app/office/layout.tsx`, `src/app/office/components/header-nav.tsx` — root shell, sidebar, nav.
- `src/app/office/page.tsx` — dashboard home (all 4 widgets, badges, skeleton states).
- `src/app/office/reports/page.tsx`, `src/modules/analytics/components/conversion-funnel.tsx`, `src/modules/analytics/components/repeat-customers-list.tsx` — the only real in-scope "chart-like" surfaces (the 4 `recharts`-based charts all live under `/super-admin/analytics`, out of scope for this tenant-facing feature).
- `src/app/office/settings/layout.tsx` — settings sub-nav.

### Design Decisions (All Approved)
- Tenant-level (not per-user) setting — one admin choice applies to everyone at that tenant, matching how `tenant_settings` already stores one row per tenant.
- Dark mode uses the project's real `@custom-variant dark (&:is(.dark *))` selector already defined in `globals.css` — not a new mechanism, not a `prefers-color-scheme` media query.
- Chart colors validated against `dataviz` skill's `validate_palette.js` for the real dark surface (`#001226`): `emerald-500`/`amber-500` FAIL the dark lightness band; `emerald-600`/`amber-600` PASS and were used as the `dark:` companions in `conversion-funnel.tsx`.
- Scope explicitly limited to mechanism + highest-impact surfaces, with the remainder documented here rather than silently left incomplete.

### Known Limitations (Documented)

**~106 files under `src/app/office/` still use hardcoded Tailwind color classes (`bg-blue-600`, `text-slate-900`, etc.) instead of the semantic tokens (`bg-background`, `text-foreground`, etc.) the theme mechanism relies on.** These render correctly in Default theme (identical to before this feature) but will show light-mode colors against a dark shell when Dark theme is selected — inconsistent contrast on badges, form inputs, table rows, and card backgrounds in these areas.

**Search method used** (stated plainly — see "Completeness" below): six `grep -rln` passes against `src/app/office` and `src/modules`, `--include="*.tsx"`, excluding the files already converted by this feature:
```
grep -rln -E 'bg-blue-[0-9]{3}|text-blue-[0-9]{3}|border-blue-[0-9]{3}'       src/app/office src/modules --include="*.tsx"
grep -rln -E 'bg-amber-[0-9]{3}|text-amber-[0-9]{3}|border-amber-[0-9]{3}'    src/app/office src/modules --include="*.tsx"
grep -rln -E 'bg-emerald-[0-9]{3}|text-emerald-[0-9]{3}|border-emerald-[0-9]{3}' src/app/office src/modules --include="*.tsx"
grep -rln -E 'bg-red-[0-9]{3}|text-red-[0-9]{3}|border-red-[0-9]{3}'          src/app/office src/modules --include="*.tsx"
grep -rln -E 'bg-slate-[0-9]{3}|text-slate-[0-9]{3}|border-slate-[0-9]{3}'    src/app/office src/modules --include="*.tsx"
grep -rln -E 'bg-white\b|bg-zinc-[0-9]{3}|text-zinc-[0-9]{3}'                 src/app/office src/modules --include="*.tsx"
```
Results deduplicated to **106 unique files**. `src/modules/` contributed no additional files beyond the two already converted — its files are mostly logic/schemas with little or no hardcoded-color JSX.

**Completeness: this is a best-effort sample by literal-class search, not an exhaustive audit.** It will miss:
- Inline `style={{ color: ... }}` or hex/rgb literals, if any exist (not separately checked).
- Colors composed via JS template strings or variables rather than literal Tailwind class tokens (e.g. `` `bg-${color}-500` ``).
- Any use of plain `gray-*` (not searched — the app's locked palette uses `slate`, not `gray`, so this is expected to be near-zero, but not confirmed).
- Non-`.tsx` sources (`.ts` files) — not searched, since JSX/className usage is expected almost exclusively in `.tsx`.

Grouped by area (counts are unique files per area; a file can appear once per area but was often flagged by more than one color pattern — e.g. a status pill using blue, amber, emerald, and red together):

| Area | Files | What's typically hardcoded |
|---|---|---|
| `settings/*` sub-pages | 25 | Status/role badges (staff roles, mailbox connection state, AI assistant mode), form inputs and buttons (pricing, inventory, invoice template, branding forms), table row styling (inventory list, staff list, email-label list) |
| `storage/*` | 12 | Crate/unit status pills (`crate-status-control.tsx`, `unit-row.tsx`), crate stats matrix backgrounds, forms (`crate-form.tsx`, `create-unit-form.tsx`) |
| `email/*` | 12 | Thread/message state badges, AI draft review banners, reply composer, review-queue item cards, label suggestion pills |
| `leads/*` | 7 | Kanban board/column backgrounds, lead-card source/stage badges, edit-lead form |
| `jobs/*` | 7 | Completion-summary card, edit-job/edit-actual-times forms, job list status styling |
| `clients/*` | 7 | Contact cards, negotiated-rate card, create-lead/create-client/edit-contact forms |
| `scheduling/*` | 6 | Calendar sidebar, scheduling board, unified calendar/list-view, creation modal |
| `fleet/*` | 6 | Vehicle forms (create/edit), document-upload, maintenance-log, vehicle detail page |
| `office/components/*` (shared) | 6 | Announcement banner stack, notification bell, task-creation form, timeline view, widget-error state, onboarding-reminder banner |
| `workflows/*` | 4 | Workflow builder form, run logs, workflow list/detail |
| `social/*` | 4 | Post composer, post-item status badges, cancel button |
| `quotes/*` | 3 | Route summary, volume calculator, quote detail page |
| `tasks/*` | 2 | Task list priority/status styling |
| `onboarding/*` | 2 | Onboarding wizard client, onboarding page |
| `invoices/*` | 2 | Edit-draft-invoice form, invoice detail page |
| `payments/*` | 1 | Payment detail page |

**Full file list** (all 106, one path per line, grouped as above):

<details>
<summary>settings/* (25)</summary>

```
src/app/office/settings/ai-assistant/components/mode-selector.tsx
src/app/office/settings/ai-assistant/page.tsx
src/app/office/settings/billing/components/billing-panel.tsx
src/app/office/settings/billing/page.tsx
src/app/office/settings/branding/components/branding-form.tsx
src/app/office/settings/branding/page.tsx
src/app/office/settings/email-labels/components/label-form-dialog.tsx
src/app/office/settings/email-labels/components/label-list.tsx
src/app/office/settings/email-labels/page.tsx
src/app/office/settings/inventory/components/create-inventory-form.tsx
src/app/office/settings/inventory/components/edit-inventory-form.tsx
src/app/office/settings/inventory/components/inventory-list.tsx
src/app/office/settings/inventory/page.tsx
src/app/office/settings/invoice-template/components/template-editor.tsx
src/app/office/settings/invoice-template/page.tsx
src/app/office/settings/mailboxes/components/connect-gmail-button.tsx
src/app/office/settings/mailboxes/components/connect-imap-form.tsx
src/app/office/settings/mailboxes/components/mailbox-list.tsx
src/app/office/settings/mailboxes/page.tsx
src/app/office/settings/pricing/components/pricing-form.tsx
src/app/office/settings/pricing/page.tsx
src/app/office/settings/staff/components/invite-staff-form.tsx
src/app/office/settings/staff/components/staff-list.tsx
src/app/office/settings/staff/page.tsx
src/app/office/settings/web-widget/components/web-widget-settings-client.tsx
```
</details>

<details>
<summary>storage/* (12)</summary>

```
src/app/office/storage/components/crate-stats-matrix.tsx
src/app/office/storage/crates/[id]/components/crate-associate-panel.tsx
src/app/office/storage/crates/[id]/components/crate-status-control.tsx
src/app/office/storage/crates/[id]/components/storage-unit-select.tsx
src/app/office/storage/crates/[id]/page.tsx
src/app/office/storage/crates/new/components/crate-form.tsx
src/app/office/storage/crates/new/page.tsx
src/app/office/storage/page.tsx
src/app/office/storage/units/[id]/page.tsx
src/app/office/storage/units/components/create-unit-form.tsx
src/app/office/storage/units/components/unit-row.tsx
src/app/office/storage/units/page.tsx
```
</details>

<details>
<summary>email/* (12)</summary>

```
src/app/office/email/[threadId]/components/ai-draft-review.tsx
src/app/office/email/[threadId]/components/associate-thread.tsx
src/app/office/email/[threadId]/components/message-list.tsx
src/app/office/email/[threadId]/components/reply-composer.tsx
src/app/office/email/[threadId]/components/thread-labels.tsx
src/app/office/email/[threadId]/page.tsx
src/app/office/email/auto-sent-log/page.tsx
src/app/office/email/components/thread-list.tsx
src/app/office/email/page.tsx
src/app/office/email/review-queue/components/label-suggestion-queue-item.tsx
src/app/office/email/review-queue/components/queue-item.tsx
src/app/office/email/review-queue/page.tsx
```
</details>

<details>
<summary>leads/* (7)</summary>

```
src/app/office/leads/[id]/components/edit-lead-form.tsx
src/app/office/leads/[id]/components/quotes-list.tsx
src/app/office/leads/[id]/page.tsx
src/app/office/leads/components/kanban-board.tsx
src/app/office/leads/components/kanban-column.tsx
src/app/office/leads/components/lead-card.tsx
src/app/office/leads/page.tsx
```
</details>

<details>
<summary>jobs/* (7)</summary>

```
src/app/office/jobs/[id]/components/completion-summary-card.tsx
src/app/office/jobs/[id]/components/edit-actual-times-form.tsx
src/app/office/jobs/[id]/components/edit-job-form.tsx
src/app/office/jobs/[id]/page.tsx
src/app/office/jobs/components/manual-job-form.tsx
src/app/office/jobs/new/page.tsx
src/app/office/jobs/page.tsx
```
</details>

<details>
<summary>clients/* (7)</summary>

```
src/app/office/clients/[id]/components/create-lead-form.tsx
src/app/office/clients/[id]/components/edit-contact-form.tsx
src/app/office/clients/[id]/components/negotiated-rate-card.tsx
src/app/office/clients/[id]/page.tsx
src/app/office/clients/components/contacts-client.tsx
src/app/office/clients/components/create-client-form.tsx
src/app/office/clients/page.tsx
```
</details>

<details>
<summary>scheduling/* (6)</summary>

```
src/app/office/scheduling/components/calendar-sidebar.tsx
src/app/office/scheduling/components/scheduling-board.tsx
src/app/office/scheduling/components/unified-calendar.tsx
src/app/office/scheduling/components/unified-creation-modal.tsx
src/app/office/scheduling/components/unified-list-view.tsx
src/app/office/scheduling/page.tsx
```
</details>

<details>
<summary>fleet/* (6)</summary>

```
src/app/office/fleet/[id]/components/document-upload-form.tsx
src/app/office/fleet/[id]/components/edit-vehicle-form.tsx
src/app/office/fleet/[id]/components/maintenance-log-form.tsx
src/app/office/fleet/[id]/page.tsx
src/app/office/fleet/components/create-vehicle-form.tsx
src/app/office/fleet/page.tsx
```
</details>

<details>
<summary>office/components/* — shared (6)</summary>

```
src/app/office/components/announcement-banner-stack.tsx
src/app/office/components/create-task-form.tsx
src/app/office/components/notification-bell.tsx
src/app/office/components/onboarding-reminder-banner.tsx
src/app/office/components/timeline-view.tsx
src/app/office/components/widget-error.tsx
```
</details>

<details>
<summary>workflows/* (4)</summary>

```
src/app/office/workflows/[id]/WorkflowBuilderForm.tsx
src/app/office/workflows/[id]/logs/page.tsx
src/app/office/workflows/[id]/page.tsx
src/app/office/workflows/page.tsx
```
</details>

<details>
<summary>social/* (4)</summary>

```
src/app/office/social/components/cancel-button.tsx
src/app/office/social/components/composer-form.tsx
src/app/office/social/components/social-post-item.tsx
src/app/office/social/page.tsx
```
</details>

<details>
<summary>quotes/* (3)</summary>

```
src/app/office/quotes/[id]/components/route-summary.tsx
src/app/office/quotes/[id]/components/volume-calculator.tsx
src/app/office/quotes/[id]/page.tsx
```
</details>

<details>
<summary>tasks/*, onboarding/*, invoices/*, payments/* (7)</summary>

```
src/app/office/tasks/components/tasks-list.tsx
src/app/office/tasks/page.tsx
src/app/office/onboarding/components/wizard-client.tsx
src/app/office/onboarding/page.tsx
src/app/office/invoices/[id]/components/edit-draft-invoice-form.tsx
src/app/office/invoices/[id]/page.tsx
src/app/office/payments/[id]/page.tsx
```
</details>

**Explicitly out of scope (not part of this gap list):** the 4 Super Admin analytics charts (`growth-charts.tsx`, `horizontal-bar-chart.tsx`, `quotes-bookings-chart.tsx`, `status-donut.tsx`, all under `/super-admin/analytics`) — a separate, tenant-independent area of the app, not covered by this feature's scope decision.

### Files Summary

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/20260813140000_add_tenant_ui_theme.sql` | ✓ Applied | Adds `ui_theme` enum + column |
| `src/app/office/layout.tsx` | ✓ Converted | Theme activation point, root shell |
| `src/app/office/components/header-nav.tsx` | ✓ Converted | Sidebar nav |
| `src/app/office/page.tsx` | ✓ Converted | Dashboard home |
| `src/app/office/reports/page.tsx` | ✓ Converted | Reports page |
| `src/app/office/settings/layout.tsx` | ✓ Converted | Settings sub-nav |
| `src/modules/analytics/components/conversion-funnel.tsx` | ✓ Converted | In-scope chart-like component |
| `src/modules/analytics/components/repeat-customers-list.tsx` | ✓ Converted | In-scope chart-like component |
| `src/app/office/settings/appearance/*` | ✓ New | Theme picker UI + action |
| 106 files listed above | ✗ Not converted | Documented, known follow-up |

### Testing Checklist
- ✓ `ui_theme` column applied and defaults to `'default'`.
- ✓ Selecting Dark in `/office/settings/appearance` sets `.dark` on the root shell (verified via DOM inspection, not URL alone).
- ✓ Converted surfaces (dashboard, reports, nav, conversion funnel, repeat customers) render correctly in both themes.
- ✓ Chart dark-mode colors pass `validate_palette.js` against the real dark surface.
- ✗ The 106 files above render with light-mode colors under Dark theme — deferred, documented here and on the Appearance settings page itself.

### What This Branch Delivers
- ✓ Real, working tenant-level theme mechanism (DB-backed, no client-side-only hack).
- ✓ Genuine Dark theme, not a cosmetic filter — uses the project's existing `dark:` variant infrastructure.
- ✓ Root shell, nav, dashboard home, reports, and both in-scope chart-like components fully theme-aware.
- ✓ Validated dark-mode chart colors (dataviz skill's contrast/CVD/lightness checks).
- ✓ Full, real, grep-sourced inventory of what's not yet converted, grouped by area, with the exact search method and its known blind spots stated — not a silent gap.

---

**BRANCH STATUS: Mechanism + highest-impact surfaces COMPLETE. 106 files remain on hardcoded colors — itemized above, also referenced live on `/office/settings/appearance`.**

**Note:** Converting the remaining 106 files is mechanical (swap hardcoded Tailwind classes for semantic tokens, following the exact pattern already applied to the 8 converted files) but was out of scope for this pass per the user's own "mechanism + highest-impact surfaces" decision. No further design decisions are needed to pick it up — it's direct follow-on work whenever prioritized.
