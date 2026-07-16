import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// For server-side code with no user session (e.g. public, unauthenticated
// API routes). Bypasses RLS entirely — every access decision this client
// makes must be enforced explicitly in application code, not left to RLS.
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
