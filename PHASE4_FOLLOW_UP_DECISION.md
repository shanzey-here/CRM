# Phase 4 · Epic F — "Follow Up" Definition & Decision Record

**Branch:** `feature/phase4-follow-up-definition` (decision-only, no feature code)
**Consumed by:** `feature/phase4-follow-up-action-and-transition` (Epic F build branch)
**Status:** Decided. Recorded here + as a code comment above `getLeadsNeedingFollowUp()` in `src/modules/leads/server/repository.ts`.

---

## 1. What exists today (verified against code, not the audit prose)

### `getLeadsNeedingFollowUp(supabase, tenantId, limit = 5)` — `src/modules/leads/server/repository.ts`
- Returns non-archived leads where `stage IN ('inquiry', 'quote_sent')`, tenant-scoped.
- Ordered `updated_at DESC`, capped at `limit` (called with 5).
- **No time / staleness threshold exists.** The name is misleading — a lead created 10 minutes ago and a lead untouched for 3 months are treated identically. It is effectively "the N most recently-updated open leads."
- **Does not include the `follow_up` stage itself** — only `inquiry` and `quote_sent`.

### Only caller
- `LeadsFollowUpWidget` in `src/app/office/page.tsx` (Dashboard, heading "Leads to Follow Up"). No other usage anywhere.
- The widget is **purely informational**: renders name + "Updated: MMM d" + source + stage badge. No links, no buttons, no navigation, no stage changes.

### Unrelated, do not confuse with the above
- `src/app/office/leads/components/lead-card.tsx` has its own client-side ⚠ cue: any Kanban card whose `updated_at` is ≥ 14 days old, in **any** stage. Not wired to `getLeadsNeedingFollowUp()`.
- The Kanban **"Follow Up" quick action is a disabled stub** today (`lead-quick-action-modals.tsx`, `follow_up` config). `updateLeadStage()` already accepts `follow_up` as a valid target stage.

---

## 2. The decision

**"Follow Up" is MANUAL and action-based (Option B).**

A staff member logs a real follow-up they just performed (a call made, an email sent, a note) via the Kanban / lead-detail "Follow Up" quick action. **That logged action is what moves the lead to the `follow_up` stage.** There is no automatic, staleness-driven transition — nothing moves a lead to `follow_up` on a timer.

Rationale:
- Consistent with the other Epic D/E quick actions (Schedule Survey, Send Quote), which are all manual, staff-initiated "real process triggers."
- The existing `getLeadsNeedingFollowUp()` is not a staleness engine (no threshold) and never touches the `follow_up` stage, so "connecting it to the column" was never a real option without building new logic anyway.

### `getLeadsNeedingFollowUp()` — LEFT AS-IS
- **Not reused, not extended, not called** by the new Follow Up action.
- Keeps powering only the Dashboard `LeadsFollowUpWidget`, unchanged.
- Renaming it (it is not really "needing follow up") is **out of scope** for Epic F — leave it. If a future branch wants the widget to reflect the manual model, that is its own decision.
- No staleness threshold should be added to it as part of Epic F.

### No hybrid
There is no idle-clock to reset, because no automatic mechanism is being built. If someone later wants staleness-based surfacing, that is a separate, future decision — not part of "Follow Up."

---

## 3. What the manual Follow Up action must capture

Per the product decision, the action records three things plus the implicit metadata (who / when):

| Field | Type | Notes for the build branch |
|---|---|---|
| **Note** | free text, required | What was said/done, e.g. "Left voicemail, will retry Thursday." |
| **Contact method** | enum `phone` / `email` / `text` | **Reuse the existing `contact_method` Postgres enum** (already used by `contacts.preferred_contact_method`). Do not invent a new enum. |
| **Next reminder date** | date, optional | Creates a dated reminder. **Reuse the existing `tasks` table** (`src/modules/tasks/`, has `due_date`) — it already feeds the Dashboard `TasksWidget`. Do not build a parallel reminder system. |

### Transition & activity logging
- The stage move to `follow_up` **must go through the canonical `updateLeadStage()`** (`src/app/office/leads/actions.ts`) — same as every other quick action. That already emits `lead.stage_changed` → Postgres trigger → `activities` row, so the *transition* is auto-logged. Do not add a second `createActivity()` call for the transition itself.
- The follow-up **note/method** should be persisted as its own record so it is visible on the lead's Activity Timeline. Preferred: a `createActivity()` call with `activity_type = 'call'` or `'note'` (the `activity_type` enum is `note | status_change | email | call | task | system | stage_change`). The build branch decides `call` vs `note` vs a mapping from contact method — that is an implementation detail, not a definition question.
- Role gating: `updateLeadStage()` already restricts to `tenant_admin` / `dispatcher`. The action inherits that.

### Out of scope for the Follow Up action
- No automatic transitions.
- No change to `getLeadsNeedingFollowUp()` or the Dashboard widget.
- No new "reminder" table or "follow-up" table — reuse `tasks` + `activities`.
