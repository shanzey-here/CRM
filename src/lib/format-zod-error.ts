import { ZodIssue } from 'zod'

// Human-readable field names for the technical schema keys that show up in
// zod issues — extend as new fields need friendlier labels. Falls back to
// the raw key (title-cased) for anything not listed here.
const FIELD_LABELS: Record<string, string> = {
  brand_id: 'Brand',
  lead_id: 'Lead',
  contact_id: 'Contact',
  final_price: 'Final price',
  total_price: 'Total price',
}

function labelFor(path: (string | number)[]): string {
  const key = String(path[0] ?? '')
  return FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// One shared formatter for turning a zod safeParse failure's real
// field-level issues into a readable string — used everywhere a Server
// Action returns `details: parsed.error.issues` instead of a bare
// "Validation failed" string, so a caller always shows real detail.
export function formatZodIssues(issues: ZodIssue[] | undefined): string {
  if (!issues || issues.length === 0) return 'Validation failed'
  return issues.map((issue) => `${labelFor(issue.path)}: ${issue.message}`).join('; ')
}
