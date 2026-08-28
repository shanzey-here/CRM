import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: user } = await supabase.from('users').select('id, tenant_id, email').eq('email', 'admin@devtest.local').single()
  if (!user) throw new Error('admin@devtest.local user not found')
  const tenantId = user.tenant_id
  console.log(`Setting up social module entitlements for tenant ${tenantId}...`)

  // 1. Enable module in tenant_modules
  const { data: modRes, error: modErr } = await supabase
    .from('tenant_modules')
    .upsert(
      { tenant_id: tenantId, module_key: 'social_media', enabled: true },
      { onConflict: 'tenant_id,module_key' }
    )
    .select()
  if (modErr) throw modErr
  console.log('Updated tenant_modules:', modRes)

  // 2. Add social_media: true to the tenant's current SaaS Plan entitlements
  const { data: subRow } = await supabase.from('tenant_subscriptions').select('price_id').eq('tenant_id', tenantId).single()
  if (subRow) {
    const { data: priceRow } = await supabase.from('saas_prices').select('plan_id').eq('id', subRow.price_id).single()
    if (priceRow) {
      const { data: planRow } = await supabase.from('saas_plans').select('id, entitlements').eq('id', priceRow.plan_id).single()
      if (planRow) {
        const currentEntitlements = (planRow.entitlements as Record<string, unknown>) || {}
        const updatedEntitlements = { ...currentEntitlements, social_media: true }
        const { error: planErr } = await supabase
          .from('saas_plans')
          .update({ entitlements: updatedEntitlements })
          .eq('id', planRow.id)
        if (planErr) throw planErr
        console.log(`Updated saas_plan ${planRow.id} entitlements:`, updatedEntitlements)
      }
    }
  }

  // Also update standard "Pro" and "Growth" plans if needed
  const { data: allPlans } = await supabase.from('saas_plans').select('id, name, entitlements')
  for (const plan of allPlans || []) {
    const current = (plan.entitlements as Record<string, unknown>) || {}
    if (plan.name.includes('Pro') || plan.name.includes('Growth')) {
      await supabase.from('saas_plans').update({
        entitlements: { ...current, social_media: true }
      }).eq('id', plan.id)
      console.log(`Updated plan "${plan.name}" with social_media: true`)
    }
  }

  console.log('Entitlement update complete!')
}

main().catch((err) => {
  console.error('Error enabling social module:', err)
  process.exit(1)
})
