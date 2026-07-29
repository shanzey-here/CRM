import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Dynamic import so dotenv's config() above runs BEFORE
  // modules/payments/server/stripe.ts reads process.env.STRIPE_SECRET_KEY
  // at module-load time — a static top-level import would be hoisted
  // ahead of config(), same class of ordering bug real Next.js code never
  // hits (env vars are loaded before any module code runs there).
  const { sweepCrateBilling } = await import('../../src/modules/storage/server/billing')
  console.log('Running sweepCrateBilling() at', new Date().toISOString())
  const result = await sweepCrateBilling(serviceClient)
  console.log(JSON.stringify(result, null, 2))
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
