type AppMetadata = {
  is_super_admin?: boolean
  tenant_role?: string
  [key: string]: unknown
}

// Single source of truth for "where does this role land on '/'". Extracted
// from src/lib/supabase/middleware.ts after a commit (b61af524, 2026-07-20)
// unrelated to auth silently regressed tenant_admin's target — see
// tests/middleware_dashboard_path_test.ts.
export function getCorrectDashboardPath(appMetadata: AppMetadata | null | undefined): string {
  const meta = appMetadata || {}
  if (meta.is_super_admin) {
    return '/super-admin'
  }
  switch (meta.tenant_role) {
    case 'tenant_admin':
    case 'dispatcher':
      return '/office'
    case 'crew':
      return '/crew'
    case 'customer':
      return '/customer'
    default:
      return '/'
  }
}
