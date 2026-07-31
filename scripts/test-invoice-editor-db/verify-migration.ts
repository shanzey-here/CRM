import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: tenants, error } = await supabase.from('tenants').select('id, name')
  console.log('Total tenants:', tenants?.length, 'error:', error?.message)

  const { data: templates, error: tErr } = await supabase.from('invoice_templates').select('*')
  console.log('Total invoice_templates rows:', templates?.length, 'error:', tErr?.message)

  console.log('\nEvery tenant has exactly one invoice_templates row (backfill worked):')
  const templateTenantIds = new Set((templates || []).map((t: any) => t.tenant_id))
  const missing = (tenants || []).filter((t: any) => !templateTenantIds.has(t.id))
  console.log('Tenants missing a template row (must be empty):', JSON.stringify(missing))

  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const { data: devTemplate } = await supabase.from('invoice_templates').select('*').eq('tenant_id', admin!.tenant_id).single()
  console.log('\nReal dev tenant template row:', JSON.stringify(devTemplate, null, 2))
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
