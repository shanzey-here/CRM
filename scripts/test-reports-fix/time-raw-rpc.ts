import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const tenantId = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

  for (let i = 1; i <= 3; i++) {
    const t0 = Date.now()
    const { data, error } = await sc.rpc('get_conversion_funnel', {
      p_tenant_id: tenantId,
      p_start_date: '2026-05-10',
      p_end_date: '2026-08-08',
    })
    console.log(`Run ${i}: get_conversion_funnel took ${Date.now() - t0}ms | error=${error?.message ?? 'none'} | data=${JSON.stringify(data)}`)
  }

  const t1 = Date.now()
  const { data: rc, error: rcErr } = await sc.rpc('get_repeat_customers', { p_tenant_id: tenantId })
  console.log(`get_repeat_customers took ${Date.now() - t1}ms | error=${rcErr?.message ?? 'none'} | rows=${rc?.length}`)
}
main()
