# Phase 4 · Epic G — "Confirm Booking" Scope & Decision Record

**Branch:** `feature/phase4-confirm-booking-source-audit` (decision-only, no feature code)
**Consumed by:** `feature/phase4-confirm-booking-action-ui` (Epic G build branch)
**Status:** Decided. Recorded here + as a code comment above `createManualJobAction()` in `src/app/office/jobs/actions.ts`.

---

## 1. What exists today (verified against code, not the audit prose)

### The automatic path — UNTOUCHED by Epic G
`accept_quote_transaction` (`supabase/migrations/20260814090000_...sql`): when a customer accepts a quote online it atomically — sets the quote `accepted`, inserts a `jobs` row, sets the linked lead's `stage = 'confirmed_booking'`, emits `quote.accepted`, and creates a draft invoice. Fully working. Epic G does not go near it.

### The manual job path — what "Confirm Booking" will reuse
- **`create_manual_job_transaction(p_tenant_id, p_contact_id, p_brand_id, p_move_date, p_origin_address_id, p_destination_address_id, p_invoice_subtotal, p_invoice_tax_amount, p_invoice_total, p_line_items)`** — inserts a `jobs` row (`status='scheduled'`, `quote_id=NULL`), emits `job.created_manually`, creates a **draft invoice** + balance schedule via `internal_create_invoice_snapshot`. **It does NOT touch `leads`.**
- **`createManualJobAction(payload)`** (`src/app/office/jobs/actions.ts`) — validates against `CreateManualJobSchema`, computes invoice subtotal/total from `line_items` (tax hardcoded `0`), resolves the tenant default brand if `brand_id` omitted, calls the RPC, then does exclusion-constraint-protected inserts into `job_crew_assignments` / `job_vehicle_assignments` (only when crew/vehicles **and** start/end times are supplied; catches double-booking `23P01`).

### `createManualJobAction` — actual required inputs (`CreateManualJobSchema`)

| Field | Required? | Has a lead field to pre-fill from? |
|---|---|---|
| `contact_id` (uuid) | **Yes** | ✅ `leads.contact_id` |
| `title` (min 1) | **Yes** | ❌ no lead equivalent |
| `move_date` (parseable date) | **Yes** | ⚠️ `leads.preferred_move_date` (nullable) |
| `line_items[]` — `{description, quantity≥1, unit_price≥0}`, **min 1** | **Yes** | ❌ no lead price/line-item field |
| `brand_id` (uuid) | No — server resolves tenant default | ✅ `leads.brand_id` (NOT NULL) |
| `origin_address_id` / `destination_address_id` | No (nullable, RPC accepts NULL) | ⚠️ `leads.origin_address_id` / `destination_address_id` (nullable) |
| `description` | No | `leads.notes` |
| `assigned_crew` / `assigned_vehicles` | **No** — schema `.default([])` | ❌ (`leads.estimated_crew_size` is a number, not an assignment) |
| `start_time` / `end_time` | **No** — only used when assignments are present | ❌ |

### Crew / vehicle / times — NOT mandatory at creation
The manual job form has no required marker on them, the schema defaults them to `[]`, and the assignment inserts run only when a crew/vehicle list **and** start/end times are both provided. **Crew, vehicles, and scheduling times can all be deferred to the Jobs page after creation, zero code change.**

### No reusable address-selector UI exists
The manual job form **does not collect addresses at all** (always passes `null`). Leads get addresses only via `create-client-form`'s inline free-text `city` / `postcode` inputs → `createAddress()` (`src/app/office/clients/...`), which writes `addresses` rows with `line_1: '-'`. There is no address-picker component to drop in.

### Current state of the quick action
`confirm_booking` in `lead-quick-action-modals.tsx` is a **disabled stub**. Its `processExplanation` copy ("accepts the quote, creates the operational job…") is **wrong for this branch's case** — an outside-the-system booking often has no quote. `updateLeadStage()` already accepts `confirmed_booking` as a valid target.

---

## 2. The decision

**Option B — FULL CONVERSION.** The Kanban / lead-detail "Confirm Booking" quick action opens a real form (same shape as Schedule Survey / Send Quote / Log Follow-Up) and, on submit:

1. Calls the **existing `createManualJobAction`** (which wraps `create_manual_job_transaction` + the assignment inserts) — creating a real `jobs` row + **draft invoice**, exactly as the "New Job" page does. **Do NOT write a third, parallel job-creation path.**
2. Then calls the canonical **`updateLeadStage(leadId, 'confirmed_booking')`** — because `create_manual_job_transaction` does **not** move the lead itself. Job-first ordering: if job creation fails, abort and change nothing. The subsequent stage-transition failure case is **not** just "inherit the sibling actions' pattern" — it has higher stakes here and is decided explicitly in **§ 2A** below.

**Why B, not A:** a lead parked in `confirmed_booking` with no job, no schedule, and no invoice behind it is exactly the gap Phase 4 exists to close. The audit shows B is feasible without a heavyweight form — contact and brand come straight off the lead, crew/vehicles/times defer cleanly, and only `title` + one priced line item genuinely have to be entered fresh. Option A (stage-only) was rejected as not actually solving the problem; the "stage-only + nudge" variant was rejected as still leaving the job uncreated at the moment of confirmation.

---

## 2A. Partial-failure handling — job/invoice created, but `updateLeadStage()` then fails

**This is a deliberate decision, not an inherited default.** The sibling actions (Schedule Survey / Send Quote / Log Follow-Up) shrug off a failed stage transition because the orphan is a low-consequence artefact — an appointment, a sent quote, a note. Here the orphan is a **real `jobs` row and a real draft `invoices` row** (financial records) while the Kanban board still shows the lead in its old column with no explanation. Higher stakes → explicit handling required.

### Decision: Option 3 + Option 2 (retry, then a specific message)

The build branch's Confirm Booking action MUST implement this, in its own calling code only:

1. **One automatic retry** of `updateLeadStage(leadId, 'confirmed_booking')` if the first call returns `{ success: false }`. A transient DB/network blip between the job insert and the stage update is the most likely real-world cause, and a retry costs nothing (it's a second `await` of the same server action). The retry SHOULD first re-read the lead's current stage and skip the call if it is already `confirmed_booking` — this avoids a duplicate "Moved from confirmed_booking to confirmed_booking" Activity Timeline entry in the rare case where the first `updateLead` persisted but its response was lost.
2. **If the retry also fails**, the action returns `{ success: true, ... }` (the job genuinely exists — this is not a failure of the action's primary purpose) with a **specific, distinct** message, NOT a generic error:
   > "Job and draft invoice created (Job #<jobId>), but the lead's stage could not be updated automatically — move it to Confirmed Booking manually."
   This message must be visually distinct from a hard failure (e.g. a warning banner, not a red error), and must name the job so staff can find it. The UI should still close/advance as a success.

### Recovery path
The raw `StageControl` override on the lead detail page is always available to `tenant_admin` / `dispatcher` and moves the lead to any stage directly. Staff following the message above use exactly that. No data is lost; nothing needs cleanup — the job and invoice are already correct.

### Explicitly NOT doing
- **Not** making the RPC + stage change atomic. `create_manual_job_transaction` is `SECURITY DEFINER` and Postgres-side; wrapping the TS `updateLeadStage` (its own auth/role/validation/event-emission) into that transaction is real scope growth and would fork the shared stage-transition path. Rejected.
- **Not** rolling back / deleting the job + invoice if the stage change fails. Deleting real financial records to recover from a cosmetic board inconsistency is worse than the problem. The job is valid and wanted — only the board label is stale.

### Feasibility check (verified against real code)
- `updateLeadStage(leadId, newStage)` (`src/app/office/leads/actions.ts`) is a self-contained server action returning `{ success: true } | { success: false, error }`. It can be called again directly — no restructuring.
- `createManualJobAction` already returns `{ success: true, jobId }` on success, so the jobId for the message is in hand. (It does not currently surface `invoice_id` from the RPC result; the message can reference "draft invoice" generically, or the build branch may extend `createManualJobAction`'s return to include it — a one-line change, still no RPC change.)
- Retry + specific catch both live entirely in the new Confirm Booking action. **No change to `createManualJobAction` or `create_manual_job_transaction` is required.**

---

## 3. Form scope — collect UP FRONT vs. DEFER

**Chosen: "Minimal + addresses up front."**

### Collected up front (the Confirm Booking form)

| Field | Behaviour |
|---|---|
| **Contact** | Auto from `lead.contact_id`. Not editable — shown read-only for confirmation. |
| **Brand** | Auto from `lead.brand_id`. (Pass it explicitly; don't rely on the default-brand fallback since the lead already carries one.) |
| **Move date** | Required. Pre-fill from `lead.preferred_move_date` **only if present**; otherwise render empty — never a fabricated/placeholder date. |
| **Title** | Required, entered fresh. May offer a suggested default (e.g. `Move — <contact name>`) but the staff member must be able to change it. |
| **Origin + destination address** | Required up front. If the lead already has `origin_address_id` / `destination_address_id`, pass them straight through (no picker needed). If not captured, show inline `city` / `postcode` text inputs and create the `addresses` rows via the **existing `createAddress()` helper** — same pattern as `create-client-form`. Do not invent a new address path. Missing lead addresses render as empty inputs, not placeholders. |
| **One line item** | Required (`line_items` needs ≥ 1). Collect a single `description` (suggested default e.g. `Removal service (agreed)`) + an agreed total `price` → submit as `[{ description, quantity: 1, unit_price: price }]`. |

### Deferred to the Jobs page (NOT in the form)
- Full itemised line items / invoice editing
- Crew assignment
- Vehicle assignment
- Job start / end times

`createManualJobAction` already handles their absence (`assigned_crew: []`, `assigned_vehicles: []`, no `start_time`/`end_time` → no assignment inserts).

### Pre-fill discipline (same as the Send Quote action)
Only pre-fill fields the lead genuinely has real data for. A lead with no move date / no addresses opens those inputs **empty**. Never a placeholder that looks like captured data.

---

## 4. Out of scope for the Confirm Booking action
- **In scope, do not skip:** the § 2A partial-failure handling (one `updateLeadStage` retry + a specific "job created, stage not updated — move it manually" warning). The build branch implements the chosen handling, not just the happy path.
- No change to `accept_quote_transaction` or the online acceptance flow.
- No new job-creation RPC or action — reuse `createManualJobAction` / `create_manual_job_transaction` directly.
- No crew/vehicle/time capture in the quick action (defer to Jobs page).
- No attempt to pull pricing from a linked quote (this branch's premise is bookings closed outside the proposal flow; a quote-price seed could be a *future* enhancement, not Epic G).
- The build branch should also fix the stub's stale `processExplanation` copy — "accepts the quote" is wrong; there is no quote.
