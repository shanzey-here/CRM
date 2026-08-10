import { Database } from '@/types/database.types'

export type CrateStatus = Database['public']['Enums']['crate_status']

// UI-layer safeguard only — crate_status the column has no CHECK/trigger
// enforcing sequence. This map is what stops an operator picking a
// nonsensical transition (in_warehouse -> lost) from the dropdown, and is
// re-checked server-side in changeCrateStatusAction as defense-in-depth
// against a bypassed/forged request. lost/damaged are terminal: no entry
// here means no normal transition out, override-only (see crate-status-control.tsx).
//
// WARNING: KEEP IN SYNC!
// This map must exactly match the Postgres trigger logic defined in:
// supabase/migrations/[TIMESTAMP]_enforce_crate_transitions.sql
// If you update this map, you MUST update the DB trigger and vice versa.
// There is an anti-drift test in scripts/test-crate-transitions.ts to enforce this.
export const CRATE_STATUS_TRANSITIONS: Record<CrateStatus, CrateStatus[]> = {
  in_warehouse: ['reserved', 'with_customer'],
  reserved: ['with_customer', 'in_warehouse'],
  with_customer: ['returned', 'lost', 'damaged'],
  returned: ['in_warehouse', 'reserved', 'with_customer'],
  lost: [],
  damaged: [],
}

export const ALL_CRATE_STATUSES: CrateStatus[] = ['in_warehouse', 'reserved', 'with_customer', 'returned', 'lost', 'damaged']

export const CRATE_STATUS_LABELS: Record<CrateStatus, string> = {
  in_warehouse: 'In Warehouse',
  reserved: 'Reserved',
  with_customer: 'With Customer',
  returned: 'Returned',
  lost: 'Lost',
  damaged: 'Damaged',
}

export function isValidCrateTransition(from: CrateStatus, to: CrateStatus): boolean {
  if (from === to) return false
  return CRATE_STATUS_TRANSITIONS[from].includes(to)
}
