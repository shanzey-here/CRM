import { Database } from '@/types/database.types'

export type AnnouncementRecord = Database['public']['Tables']['platform_announcements']['Row']

const SEVERITY_RANK: Record<AnnouncementRecord['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

export function isAnnouncementActive(
  a: Pick<AnnouncementRecord, 'starts_at' | 'ends_at'>,
  now: Date = new Date()
): boolean {
  if (a.starts_at && new Date(a.starts_at) > now) return false
  if (a.ends_at && new Date(a.ends_at) < now) return false
  return true
}

export function matchesAnnouncementTarget(
  a: Pick<AnnouncementRecord, 'target_type' | 'target_ids'>,
  ctx: { tenantId: string; planId: string | null }
): boolean {
  switch (a.target_type) {
    case 'all_tenants':
      return true
    case 'specific_tenants':
      return a.target_ids.includes(ctx.tenantId)
    case 'by_plan':
      return ctx.planId !== null && a.target_ids.includes(ctx.planId)
    default:
      return false
  }
}

export function sortAnnouncements<T extends Pick<AnnouncementRecord, 'severity' | 'created_at'>>(
  list: T[]
): T[] {
  return [...list].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (severityDiff !== 0) return severityDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}
