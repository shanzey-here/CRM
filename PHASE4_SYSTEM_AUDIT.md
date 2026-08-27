# Phase 4 System Audit — Authoritative Technical Reference

> **Purpose:** Single source of truth for all Phase 4 development branches. This document audits the exact current state of schemas, components, Server Actions, database transactions, RPC functions, realtime subscriptions, and audio alert features. Subsequent agents should read this reference directly rather than re-deriving facts.

---

## Table of Contents
1. [Leads Schema, Stage Enum & Zod Definitions](#1-leads-schema-stage-enum--zod-definitions)
2. [Kanban Board Architecture & Components](#2-kanban-board-architecture--components)
3. [Drag-and-Drop Stage-Update Logic & State Flow](#3-drag-and-drop-stage-update-logic--state-flow)
4. [Notification System (Bell, Sound Chime & Realtime)](#4-notification-system-bell-sound-chime--realtime)
5. [Scheduling & Unified Calendar Architecture (Real Event Types)](#5-scheduling--unified-calendar-architecture-real-event-types)
6. [Quote Creation & Proposal Sending Flows](#6-quote-creation--proposal-sending-flows)
7. [Quote Acceptance & Manual Job Creation Transactions](#7-quote-acceptance--manual-job-creation-transactions)
8. [Dashboard "Upcoming Moves" & Operational Widgets](#8-dashboard-upcoming-moves--operational-widgets)
9. [Master Cross-Reference File Matrix](#9-master-cross-reference-file-matrix)

---

## 1. Leads Schema, Stage Enum & Zod Definitions

### 1.1 Database Schema & Enums
- **Primary Migration Files:**
  - `supabase/migrations/00001_phase0_foundations.sql` (Initial enum and table)
  - `supabase/migrations/00079_phase2_lead_priority.sql` (Adds `priority`)
  - `supabase/migrations/20260809213100_add_lead_estimates.sql` (Adds `estimated_hours`, `estimated_crew_size`)
  - `supabase/migrations/20260814090000_add_brands_and_thread_brand_id.sql` (Adds `brand_id`)

#### `lead_stage` Enum (Postgres Database Enum)
```sql
CREATE TYPE lead_stage AS ENUM (
  'inquiry',
  'survey_scheduled',
  'quote_sent',
  'follow_up',
  'confirmed_booking',
  'completed',
  'archived'
);
```
*Note: The DB enum contains **7** values. However, only 5 are active Kanban stages (see section 2.1).*

#### `priority_level` Enum
```sql
CREATE TYPE priority_level AS ENUM (
  'low',
  'medium',
  'high'
);
```

#### `leads` Table Schema
```sql
CREATE TABLE public.leads (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id              uuid NOT NULL,
  brand_id                uuid NOT NULL REFERENCES public.brands(id),
  stage                   lead_stage NOT NULL DEFAULT 'inquiry',
  source                  text,                  -- e.g. 'website', 'compare_my_move', 'referral'
  preferred_move_date     date,
  origin_address_id       uuid,
  destination_address_id  uuid,
  estimated_volume        numeric,               -- cubic feet / volume
  estimated_hours         numeric,               -- estimated labor hours
  estimated_crew_size     numeric,               -- estimated crew size
  assigned_to             uuid,                  -- user (dispatcher / crew)
  notes                   text,
  is_archived             boolean NOT NULL DEFAULT false,
  priority                priority_level NOT NULL DEFAULT 'medium',
  created_by              uuid REFERENCES public.users(id),
  updated_by              uuid REFERENCES public.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz,

  CONSTRAINT leads_tenant_unique UNIQUE (id, tenant_id),
  CONSTRAINT leads_contact_fk FOREIGN KEY (contact_id, tenant_id) REFERENCES public.contacts(id, tenant_id),
  CONSTRAINT leads_origin_address_fk FOREIGN KEY (origin_address_id, tenant_id) REFERENCES public.addresses(id, tenant_id),
  CONSTRAINT leads_destination_address_fk FOREIGN KEY (destination_address_id, tenant_id) REFERENCES public.addresses(id, tenant_id),
  CONSTRAINT leads_assigned_to_fk FOREIGN KEY (assigned_to, tenant_id) REFERENCES public.users(id, tenant_id)
);
```

### 1.2 TypeScript Schemas (`src/modules/leads/schemas.ts`)
- **`leadStageEnum`:**
  ```ts
  export const leadStageEnum = z.enum([
    'inquiry',
    'survey_scheduled',
    'quote_sent',
    'follow_up',
    'confirmed_booking',
    'completed',
    'archived',
  ])
  ```
- **`leadPriorityEnum`:** `z.enum(['low', 'medium', 'high'])`
- **`insertLeadSchema`:**
  - `contact_id`: `z.string().uuid()`
  - `brand_id`: `z.string().uuid().optional()` (server defaults to tenant default brand if omitted)
  - `stage`: `leadStageEnum.default('inquiry')`
  - `source`, `preferred_move_date`, `notes`: `z.string().optional().nullable()`
  - `origin_address_id`, `destination_address_id`, `assigned_to`: `z.string().uuid().optional().nullable()`
  - `estimated_volume`, `estimated_hours`, `estimated_crew_size`: `z.number().optional().nullable()`
  - `priority`: `leadPriorityEnum.optional()`
- **`updateLeadDetailsSchema`:** Form validation for detail edits (`notes`, `preferred_move_date`, `estimated_volume`, `assigned_to`, `source`, `priority`). Explicitly excludes `stage`, `contact_id`, `origin_address_id`, `destination_address_id` (stage changes occur exclusively via `updateLeadStage`).
- **`publicLeadSubmissionSchema`:** Handles public embed form inputs (`first_name`, `last_name`, `email`, `phone`, `preferred_move_date`, `notes`, and `company_website` honeypot).

### 1.3 Lead Repository (`src/modules/leads/server/repository.ts`)
- `getLeads(supabase, tenantId, options?: LeadFilterOptions)`: Filtered by `tenant_id`, optional `stage`, pagination `limit`/`offset`.
- `getLeadById(supabase, tenantId, id)`: Single lead scoped to `tenant_id`.
- `createLead(supabase, tenantId, payload)`: Inserts new lead row with `tenant_id`.
- `updateLead(supabase, tenantId, id, payload)`: Scoped update returning updated `Lead`.
- `archiveLead(supabase, tenantId, id)`: Sets `is_archived: true`.
- `getLeadsNeedingFollowUp(supabase, tenantId, limit = 5)`: Returns non-archived leads in `inquiry` or `quote_sent` stage ordered by `updated_at DESC`.

---

## 2. Kanban Board Architecture & Components

### 2.1 Kanban Board Stage Configuration (`src/app/office/leads/constants.ts`)
The visual Kanban board renders **5 active stages** (filtering out `completed` and `archived`):
```ts
export const KANBAN_STAGES = [
  { id: 'inquiry', label: 'Inquiry', color: '#94a3b8' },                     // Slate 400
  { id: 'survey_scheduled', label: 'Survey Scheduled', color: '#64748b' },   // Slate 500
  { id: 'quote_sent', label: 'Quote Sent', color: '#3b82f6' },               // Blue 500
  { id: 'follow_up', label: 'Follow Up', color: '#f59e0b' },                 // Amber 500
  { id: 'confirmed_booking', label: 'Confirmed Booking', color: '#10b981' }, // Emerald 500
] as const
```

### 2.2 Component Hierarchy & Responsibilities
1. **`src/app/office/leads/page.tsx` (Server Component)**
   - Role guard inherited from `/office/layout.tsx` (`tenant_admin` | `dispatcher`).
   - Fetches active leads using Supabase `.in('stage', ['inquiry', 'survey_scheduled', 'quote_sent', 'follow_up', 'confirmed_booking'])` and `.eq('is_archived', false)`.
   - Passes `initialLeads` to `<KanbanBoard />`.

2. **`src/app/office/leads/components/kanban-board.tsx` (Client Component)**
   - Drag library: `@dnd-kit/core` with `PointerSensor` (configured with `activationConstraint: { distance: 8 }` to prevent misclicks).
   - Collision detection: Custom `columnAwareCollisionDetection` combining `pointerWithin` and `closestCorners` to avoid resolving card drop rects over column drop targets.
   - Holds local optimistic state: `const [leads, setLeads] = useState<Lead[]>(initialLeads)`.
   - Renders `<DragOverlay>` with a ghost `<LeadCard isDragOverlay />`.

3. **`src/app/office/leads/components/kanban-column.tsx` (Client Component)**
   - Uses `useDroppable({ id: stage.id })`.
   - Uses `@dnd-kit/sortable` with `SortableContext` and `verticalListSortingStrategy`.
   - Smooth entrance animation using `framer-motion` (`opacity` and `y` translation).
   - Shows active stage lead count and empty state ("Drop here").

4. **`src/app/office/leads/components/lead-card.tsx` (Client Component)**
   - Uses `useSortable({ id: lead.id })`.
   - Renders:
     - `GripVertical` drag handle.
     - Contact ID / name placeholder (`lead.contact_id`).
     - Origin $\rightarrow$ Destination address preview badges (`AddressPreview`).
     - Preferred move date (`formatDate(lead.preferred_move_date)`).
     - Source tag (`lead.source`).
     - Time in current stage (`timeInStage(lead.updated_at, lead.created_at)`).
     - Stale threshold indicator: Highlights amber with warning symbol if in current stage $\ge 14\text{ days}$.
   - Interaction: Clicking anywhere on the card invokes `router.push('/office/leads/' + lead.id)`.

5. **`src/app/office/leads/[id]/page.tsx` (Lead Detail Page)**
   - Renders `StageControl` dropdown, `EditLeadForm` dialog, `QuotesList`, and `TimelineView`.

---

## 3. Drag-and-Drop Stage-Update Logic & State Flow

### 3.1 Execution Flow
```
[User Drags Card] ───> handleDragStart (sets activeId)
         │
         ▼
[Drop Card on Column] ───> handleDragEnd (validates over.id against KANBAN_STAGES)
         │
         ├───> Optimistic Update: setLeads(prev => updatedLocalState)
         │
         └───> startTransition ───> Server Action: updateLeadStage(leadId, newStage)
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
             [Success]                                         [Failure]
         revalidatePath('/office/leads')                Rollback: setLeads(previousLeads)
         emitEvent('lead.stage_changed')                Display Error Banner in UI
```

### 3.2 Server Action Details (`src/app/office/leads/actions.ts`)
- **Function:** `updateLeadStage(leadId: string, newStage: unknown): Promise<UpdateLeadStageResult>`
- **Guards & Validations:**
  1. `supabase.auth.getUser()`: Authenticates session and extracts `tenant_id` from `app_metadata`.
  2. Role Check: Gated strictly to `tenant_admin` and `dispatcher`.
  3. Stage Validation: Validated with `kanbanStageSchema` (`z.enum(['inquiry', 'survey_scheduled', 'quote_sent', 'follow_up', 'confirmed_booking'])`). Rejects any unrecognized or archived stage strings.
  4. UUID Validation: `z.string().uuid().safeParse(leadId)`.
  5. Cross-Tenant Scoped Mutation: Calls `updateLead(supabase, tenantId, leadId, { stage: validatedStage })`.
- **Side Effects:**
  - Emits domain event:
    ```ts
    await emitEvent(supabase, 'lead.stage_changed', 'crm', {
      lead_id: leadId,
      tenant_id: tenantId,
      new_stage: validatedStage,
      changed_by: user.id,
    })
    ```
  - Revalidates path: `revalidatePath('/office/leads')`.

---

## 4. Notification System (Bell, Sound Chime & Realtime)

### 4.1 Database Architecture
- **Migrations:**
  - `supabase/migrations/00075_phase2_notifications_db.sql`
  - `supabase/migrations/00076_phase2_trial_expiry_notification_type.sql`

#### `notification_type_enum`
```sql
CREATE TYPE public.notification_type_enum AS ENUM (
  'new_lead',
  'quote_accepted',
  'task_assigned',
  'trial_expiring_soon'
);
```

#### `notifications` Table
```sql
CREATE TABLE public.notifications (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  target_user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type  notification_type_enum NOT NULL,
  source_event_id    uuid REFERENCES public.domain_events(id) ON DELETE CASCADE,
  title              text NOT NULL,
  message            text NOT NULL,
  action_url         text,
  read_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  dedup_key          text UNIQUE
);
```
- **Realtime publication:** Enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;`.
- **RLS Policies:** `users_read_own_notifications` (`SELECT`) and `users_update_own_notifications` (`UPDATE` where `target_user_id = auth.uid()`).
- **Inserts:** Executed via Service Role in background / server functions (`createServiceRoleClient()`).

### 4.2 Generator Logic (`src/modules/notifications/server/generator.ts`)
- **Function:** `generateNotifications(eventType: string, payload: Record<string, any>, eventId: string, explicitTenantId?: string)`
- **Event Mappings:**
  - `lead.created` $\rightarrow$ Target: all `tenant_admin` and `dispatcher` users of tenant $\rightarrow$ Type: `new_lead`, action: `/office/leads/{id}`.
  - `quote.accepted` $\rightarrow$ Target: all `tenant_admin` and `dispatcher` users $\rightarrow$ Type: `quote_accepted`, action: `/office/jobs/{job_id}`.
  - `task.assigned` $\rightarrow$ Target: assigned `user_id` $\rightarrow$ Type: `task_assigned`, action: `/office/tasks`.
  - `trial.expiring_soon` $\rightarrow$ Target: all `tenant_admin` users $\rightarrow$ Type: `trial_expiring_soon`, action: `/office/settings/billing`.
- **Fault-Tolerance:** Fully wrapped in try/catch — never throws or halts the originating transaction.

### 4.3 UI Component & Web Audio Synthesizer (`src/app/office/components/notification-bell.tsx`)
- **Bell Icon:**
  - Mounted in office header navigation (`src/app/office/components/header-nav.tsx`).
  - Displays unread counter badge (capped at `99+`).
  - Dropdown displays paginated list with optimistic "Mark all read" and individual click-to-read actions.
- **Synthesized Sound Alert (Web Audio API):**
  - **No external audio/MP3 file dependency.** Audio is synthesized in real time using the browser's native `AudioContext` / `OscillatorNode`.
  - Frequency Chime:
    - Tone 1: $1318.51\text{ Hz}$ (E6 note, sine wave, duration $0.15\text{s}$).
    - Tone 2: $1046.50\text{ Hz}$ (C6 note, sine wave, duration $0.30\text{s}$, start offset $+0.1\text{s}$).
    - Exponential gain falloff down to $0.001$.
  - Autoplay Policy Handling: Audio context initialized on first user interaction (`click`, `keydown`, `touchstart`) and resumed if suspended.
- **Realtime WebSocket Subscription:**
  - Subscribes to channel: `user-notifications-${userId}`.
  - Filter: `postgres_changes` `INSERT` on table `notifications` where `target_user_id=eq.${userId}`.
  - On incoming insert: Prepends notification to state, plays Web Audio chime, and pops a floating toast alert in the bottom-right corner for 5 seconds.

---

## 5. Scheduling & Unified Calendar Architecture (Real Event Types)

### 5.1 Page Layout & Navigation (`src/app/office/scheduling/page.tsx`)
- Supports query params: `?date=YYYY-MM-DD&view=calendar|list|dispatch&range=day|week&type=jobs,tasks,appointments&crew=userId1,userId2`.
- Three tab views:
  1. `calendar`: `<UnifiedCalendar />` (Timed hour grid + all-day banner).
  2. `list`: `<UnifiedListView />` (Chronological feed of all events).
  3. `dispatch`: `<SchedulingBoard />` (Gantt resource board with vehicle & crew swimlanes).

### 5.2 Real Calendar Event Types (`src/modules/calendar/server/repository.ts`)
The unified repository merges 3 distinct entity sources into a standardized `CalendarEvent` interface:
```ts
export type CalendarEvent = {
  id: string
  type: 'job' | 'task' | 'appointment'
  title: string
  start_time: string // ISO string
  end_time?: string  // ISO string (undefined for all-day tasks)
  all_day?: boolean  // true for tasks
  status: string
  assigned_to?: string[] // user IDs
  contact_id?: string
  raw_data: any
}
```

#### Event Type 1: `'job'`
- **Source Tables:** `jobs` joined with `job_crew_assignments` (`user_id`, `scheduled_start`, `scheduled_end`).
- **Timing:** Derived from earliest `scheduled_start` and latest `scheduled_end` across crew assignments; fallbacks to `move_dateT09:00:00Z` and `move_dateT17:00:00Z`.
- **Styling:** `bg-blue-100 text-blue-800 border-blue-200`.

#### Event Type 2: `'task'`
- **Source Table:** `tasks` (`title`, `due_date`, `status`, `priority`, `assigned_to`, `contact_id`).
- **Timing:** `all_day: true` (pinned to the "All Day" banner row at the top of the day).
- **Styling:** `bg-slate-200 text-slate-800 border-slate-300` (line-through styling if `status === 'completed'`).

#### Event Type 3: `'appointment'`
- **Source Table:** `appointments` (`title`, `description`, `start_time`, `end_time`, `contact_id`, `assigned_to`, `status`).
- **Migration:** `supabase/migrations/20260811225000_add_appointments.sql`.
- **Styling:** `bg-amber-100 text-amber-800 border-amber-200`.
- **Conflict Engine:** Evaluated by `computeConflicts(timedEvents)` in `src/modules/calendar/conflict.ts`. If multiple overlapping appointments or assignments exist for the same staff/resource, it adds a red boundary ring (`ring-2 ring-red-500`) and an `AlertCircle` icon.

---

## 6. Quote Creation & Proposal Sending Flows

### 6.1 Quote Lifecycle & Statuses
The DB enum `quote_status` supports: `'draft'`, `'sent'`, `'accepted'`, `'declined'`, `'expired'`.
```
[New Lead] ───> createQuoteAction ───> [Quote: 'draft']
                                             │
      ┌──────────────────────────────────────┴──────────────────────────────────────┐
      ▼                                                                             ▼
[Inventory Selection & Routing]                                             [Pricing Engine]
saveQuoteInventoryAction & saveQuoteRouteAction                    calculateQuotePrice & savePricingCalculation
      │                                                                             │
      └──────────────────────────────────────┬──────────────────────────────────────┘
                                             ▼
                               [Generate Public Link]
                             generateProposalLinkAction
                             (generates public_token)
                                             │
                                             ▼
                                     [Quote: 'sent']
                                             │
                                             ▼
                               [Customer Proposal Page]
                                /proposal/[token]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
             [Electronic Signature]                      [Stripe Payment Intent]
              saveQuoteSignature                       generatePaymentIntentAction
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             ▼
                                 [Quote: 'accepted']
                             accept_quote_transaction
```

### 6.2 Key Server Actions & Repositories
- **Creation:** `createQuoteAction(payload)` in `src/app/office/quotes/actions.ts` calls `createQuote` in `src/modules/quotes/server/repository.ts`.
- **Inventory Snapshot:** `saveQuoteInventoryAction(quoteId, payload)` invokes the atomic Postgres function `save_quote_inventory` to snapshot item names and base volumes.
- **Route Calculation:** `calculateFullCycleRoute` in `src/modules/quotes/server/routing.ts` computes depot $\rightarrow$ origin $\rightarrow$ destination $\rightarrow$ depot matrix.
- **Pricing Calculation:** `calculateQuotePrice` in `src/modules/quotes/server/pricing.ts` invokes Postgres RPC `calculate_quote_price` + applies active `contact_pricing_overrides`.
- **Proposal Token Generation:** `generateProposalLinkAction(quoteId)` in `src/app/office/quotes/actions.ts` invokes `generate_proposal_token` RPC and stores `public_token` on `quotes`.
- **Customer Signing & Payment:** `generatePaymentIntentAction(token, signatureData)` in `src/app/proposal/[token]/actions.ts`:
  1. Uses Service Role (`createServiceRoleClient`).
  2. Creates sha256 `documentHash` of quote state.
  3. Uploads signature PNG to Supabase Storage bucket `signatures` and inserts record into `quote_signatures`.
  4. If zero deposit: Calls `markQuoteAccepted` directly.
  5. If deposit $> 0$: Generates Stripe `PaymentIntent` via `createDepositPaymentIntent`.

---

## 7. Quote Acceptance & Manual Job Creation Transactions

### 7.1 `accept_quote_transaction` RPC Function
- **Migration Location:** `supabase/migrations/20260814090000_add_brands_and_thread_brand_id.sql` (lines 388–452).
- **Signature:**
  ```sql
  accept_quote_transaction(
    p_tenant_id uuid,
    p_quote_id uuid,
    p_lead_id uuid,
    p_contact_id uuid,
    p_move_date date,
    p_origin_address_id uuid,
    p_destination_address_id uuid,
    p_stripe_payment_intent_id text DEFAULT NULL,
    p_invoice_subtotal numeric DEFAULT 0,
    p_invoice_tax_amount numeric DEFAULT 0,
    p_invoice_total numeric DEFAULT 0,
    p_line_items jsonb DEFAULT '[]'::jsonb,
    p_deposit_schedule jsonb DEFAULT NULL,
    p_balance_schedule jsonb DEFAULT NULL
  ) RETURNS jsonb
  ```
- **Execution Flow (ACID):**
  1. `SELECT brand_id INTO v_brand_id FROM quotes WHERE id = p_quote_id AND tenant_id = p_tenant_id AND status = 'sent' FOR UPDATE;`
     - *Fails closed:* If quote is not found or not in `'sent'` status, raises exception code `P0002` (handled idempotently by TS callers).
  2. Updates `quotes`: `SET status = 'accepted', accepted_at = now()`.
  3. Inserts into `jobs`: `(tenant_id, quote_id, contact_id, brand_id, status='scheduled', move_date, origin_address_id, destination_address_id) RETURNING id INTO v_job_id`.
  4. Updates associated `leads` (if present): `SET stage = 'confirmed_booking', updated_at = now()`.
  5. Inserts into `domain_events`: `event_type = 'quote.accepted'`, `payload = { quote_id, job_id }`.
  6. Invokes `internal_create_invoice_snapshot`: Generates `invoices` row (`status='draft'`), line items (`invoice_line_items`), and payment schedules (`payment_schedules`) with deposit & balance breakdown.
  7. Returns `{ "job_id": v_job_id, "invoice_id": v_invoice_id }`.

### 7.2 `create_manual_job_transaction` RPC Function
- **Migration Location:** `supabase/migrations/20260814090000_add_brands_and_thread_brand_id.sql` (lines 460–504).
- **Signature:**
  ```sql
  create_manual_job_transaction(
    p_tenant_id uuid,
    p_contact_id uuid,
    p_brand_id uuid,
    p_move_date date,
    p_origin_address_id uuid,
    p_destination_address_id uuid,
    p_invoice_subtotal numeric,
    p_invoice_tax_amount numeric,
    p_invoice_total numeric,
    p_line_items jsonb
  ) RETURNS jsonb
  ```
- **Execution Flow:**
  1. Inserts into `jobs` with `quote_id = NULL`, `brand_id = p_brand_id`, and `status = 'scheduled'`.
  2. Emits domain event `job.created_manually`.
  3. Invokes `internal_create_invoice_snapshot` with pre-built balance schedule.
  4. Returns `{ "job_id": v_job_id, "invoice_id": v_invoice_id }`.
- **TypeScript Server Action:** `createManualJobAction(payload)` in `src/app/office/jobs/actions.ts` executes the RPC, then performs exclusion-constraint-protected inserts into `job_crew_assignments` and `job_vehicle_assignments` (catching PostgreSQL double-booking error code `23P01`).

---

## 8. Dashboard "Upcoming Moves" & Operational Widgets

### 8.1 Dashboard Layout & Architecture (`src/app/office/page.tsx`)
- The main office dashboard page is a Server Component with `export const dynamic = 'force-dynamic'`.
- Uses `createAdminClient` (service role) with explicit `tenantId` parameter passing to safely bypass auth hook limitations while preserving strict tenant isolation.
- Displays 4 responsive `MotionCard` widgets wrapped in React `Suspense` skeletons:
  1. `UpcomingMovesWidget`
  2. `TasksWidget`
  3. `LeadsFollowUpWidget`
  4. `OutstandingInvoicesWidget`

### 8.2 "Upcoming Moves" Widget Specification
- **Component:** `UpcomingMovesWidget({ tenantId, adminSupabase })`
- **Data Source Function:** `getUpcomingJobs(supabase, tenantId, limit = 5)` in `src/modules/jobs/server/repository.ts`.
- **Database Query:**
  ```ts
  supabase
    .from('jobs')
    .select(`
      id,
      status,
      move_date,
      contact:contacts(first_name, last_name)
    `)
    .eq('tenant_id', tenantId)
    .gte('move_date', new Date().toISOString().split('T')[0]) // Today or future
    .not('status', 'eq', 'completed')
    .not('status', 'eq', 'cancelled')
    .order('move_date', { ascending: true })
    .limit(5)
  ```
- **Rendered Content:**
  - Contact Full Name: `{job.contact?.first_name} {job.contact?.last_name}`
  - Job Status: `Status: {job.status}`
  - Formatted Move Date: `format(new Date(job.move_date), 'MMM d, yyyy')` (or `'TBD'`) displayed in a rounded slate badge.
  - Empty State: "No upcoming moves scheduled."
  - Error State: Handled via `<WidgetError message={...} />`.

---

## 9. Master Cross-Reference File Matrix

| Functional Area | Key Source Code Files | Migration & Schema Files | Key Types / Functions / Actions |
| :--- | :--- | :--- | :--- |
| **Leads & Pipeline** | `src/modules/leads/schemas.ts`<br>`src/modules/leads/server/repository.ts`<br>`src/app/office/leads/actions.ts` | `00001_phase0_foundations.sql`<br>`00079_phase2_lead_priority.sql`<br>`20260809213100_add_lead_estimates.sql`<br>`20260814090000_add_brands_and_thread_brand_id.sql` | `lead_stage` enum (7 values)<br>`KANBAN_STAGES` (5 active)<br>`updateLeadStage()`<br>`getLeads()` |
| **Kanban UI** | `src/app/office/leads/page.tsx`<br>`src/app/office/leads/components/kanban-board.tsx`<br>`src/app/office/leads/components/kanban-column.tsx`<br>`src/app/office/leads/components/lead-card.tsx`<br>`src/app/office/leads/constants.ts` | — | `<KanbanBoard />`<br>`<KanbanColumn />`<br>`<LeadCard />`<br>`columnAwareCollisionDetection` |
| **Notifications & Audio** | `src/modules/notifications/server/generator.ts`<br>`src/modules/notifications/server/actions.ts`<br>`src/app/office/components/notification-bell.tsx`<br>`src/app/office/components/header-nav.tsx` | `00075_phase2_notifications_db.sql`<br>`00076_phase2_trial_expiry_notification_type.sql` | `notification_type_enum`<br>`generateNotifications()`<br>`playDingSound()` (Web Audio API)<br>`supabase.channel('user-notifications-...')` |
| **Scheduling & Calendar** | `src/modules/calendar/server/repository.ts`<br>`src/modules/calendar/conflict.ts`<br>`src/modules/scheduling/schema.ts`<br>`src/modules/scheduling/server/repository.ts`<br>`src/app/office/scheduling/page.tsx`<br>`src/app/office/scheduling/components/unified-calendar.tsx`<br>`src/app/office/scheduling/components/scheduling-board.tsx` | `20260811225000_add_appointments.sql`<br>`00001_phase0_foundations.sql`<br>`00078_phase2_job_crew_actual_times.sql` | `CalendarEvent` (`'job'`, `'task'`, `'appointment'`)<br>`getUnifiedCalendarData()`<br>`computeConflicts()`<br>`<UnifiedCalendar />` |
| **Quotes & Proposals** | `src/modules/quotes/schemas.ts`<br>`src/modules/quotes/server/repository.ts`<br>`src/modules/quotes/server/pricing.ts`<br>`src/modules/quotes/server/routing.ts`<br>`src/app/office/quotes/actions.ts`<br>`src/app/office/quotes/[id]/page.tsx`<br>`src/app/proposal/[token]/page.tsx`<br>`src/app/proposal/[token]/actions.ts` | `00015_phase1_pricing_calculation.sql`<br>`00016_phase1_quoting_proposal.sql`<br>`00017_phase1_quoting_acceptance.sql`<br>`00067_phase2_corporate_pricing.sql` | `calculateQuotePrice()`<br>`saveQuoteInventory()`<br>`generateProposalLinkAction()`<br>`generatePaymentIntentAction()` |
| **Transactions & Jobs** | `src/modules/jobs/schema.ts`<br>`src/modules/jobs/server/repository.ts`<br>`src/app/office/jobs/actions.ts`<br>`src/app/office/jobs/components/manual-job-form.tsx` | `20260812153021_add_manual_job_transaction.sql`<br>`20260812153022_refactor_invoice_transaction.sql`<br>`20260814090000_add_brands_and_thread_brand_id.sql` | `accept_quote_transaction()` (RPC)<br>`create_manual_job_transaction()` (RPC)<br>`createJobFromQuoteTransaction()`<br>`createManualJobAction()` |
| **Dashboard** | `src/app/office/page.tsx`<br>`src/modules/jobs/server/repository.ts`<br>`src/modules/tasks/server/repository.ts`<br>`src/modules/leads/server/repository.ts`<br>`src/modules/invoicing/server/repository.ts` | — | `<UpcomingMovesWidget />`<br>`getUpcomingJobs()`<br>`<TasksWidget />`<br>`<LeadsFollowUpWidget />`<br>`<OutstandingInvoicesWidget />` |
