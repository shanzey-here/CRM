// Validated against the dataviz skill's validate_palette.js (see the plan's
// Context section for the full run + WARN/FAIL reasoning). This project's
// locked design system has exactly 4 usable chart hues — blue, amber,
// emerald ("green"), slate — not the 8 a generic categorical palette
// assumes, so status colors intentionally reuse slate at two lightness
// steps for the two "inactive" states rather than introduce an off-palette
// 5th hue. Red is not used anywhere on this page — nothing here is an
// error/destructive state.
export const STATUS_COLORS: Record<string, string> = {
  trialing: '#2563eb', // blue-600 — primary
  active: '#059669', // emerald-600 — this app's "green"/success hue
  past_due: '#d97706', // amber-600 — matches office/layout.tsx's existing past_due banner
  suspended: '#94a3b8', // slate-400
  cancelled: '#475569', // slate-600
}

export const STATUS_LABELS: Record<string, string> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past Due',
  suspended: 'Suspended',
  cancelled: 'Cancelled',
}

// Nominal categorical, single series -> one hue (bar length carries the
// comparison, not color) — matches the dataviz skill's own rule.
export const COUNT_COLOR = '#2563eb' // blue-600 — "counts" thread
export const REVENUE_COLOR = '#059669' // emerald-600 — "money" thread, per the task's own instruction

export const CHART_CHROME = {
  grid: '#e2e8f0', // slate-200, hairline
  axisText: '#64748b', // slate-500
  mutedText: '#94a3b8', // slate-400
}
