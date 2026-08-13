import { z } from 'zod'

// Matches the real public.ui_theme Postgres enum exactly (see
// 20260813140000_add_tenant_ui_theme.sql) — keep in sync with it.
export const uiThemeSchema = z.enum(['default', 'dark'])
export type UiTheme = z.infer<typeof uiThemeSchema>
