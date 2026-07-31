import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function signInAs(email: string, password: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

async function main() {
  const { getInvoiceTemplate, updateInvoiceTemplate } = await import('../../src/modules/settings/invoice-template/server/repository')
  const { invoiceTemplateSchema, invoiceLayoutBlockSchema } = await import('../../src/modules/settings/invoice-template/schemas')

  const { data: admin } = await serviceClient.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const adminClient = await signInAs('admin@devtest.local', 'DevTest123!')
  const dispatcherClient = await signInAs('dispatcher@devtest.local', 'DevTest123!')

  console.log('========== 1. Real dev tenant template read back (seeded default) ==========')
  const { data: seeded, error: seededErr } = await getInvoiceTemplate(adminClient as any, tenantId)
  console.log(JSON.stringify(seeded, null, 2), 'error:', seededErr?.message)
  console.log('Has exactly 5 seeded blocks:', seeded?.layout_blocks?.length === 5)

  console.log('\n========== 2. Real structured update — reorder, toggle, add a spacer ==========')
  const newBlocks = [
    { type: 'header', config: { showLogo: true, alignment: 'center' } },
    { type: 'spacer', config: { heightPx: 24 } },
    { type: 'line_items_table', config: { columns: ['description', 'amount'] } },
    { type: 'totals_summary', config: { showTaxBreakdown: false } },
    { type: 'terms_text', config: { show: false } },
    { type: 'footer', config: { showPageNumber: false, customText: 'Thank you for your business.' } },
  ]
  const parsed = invoiceTemplateSchema.parse({ layout_blocks: newBlocks })
  const { data: updated, error: updateErr } = await updateInvoiceTemplate(adminClient as any, tenantId, parsed.layout_blocks)
  console.log(JSON.stringify(updated, null, 2), 'error:', updateErr?.message)

  const { data: reread } = await getInvoiceTemplate(adminClient as any, tenantId)
  // JSONB does not preserve object key insertion order, so a naive
  // JSON.stringify comparison is a false negative here — sort keys before
  // comparing to check actual values, not serialization order.
  const stableStringify = (v: any): string => JSON.stringify(v, (_k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.fromEntries(Object.keys(val).sort().map((k) => [k, val[k]])) : val))
  console.log('\nRe-read after update matches what was written (value-wise, ignoring JSONB key order):', stableStringify(reread?.layout_blocks) === stableStringify(parsed.layout_blocks))

  console.log('\n========== 3. Zod rejects a financial-looking field injected into a block config ==========')
  const maliciousBlock = { type: 'line_items_table', config: { columns: ['description'], amount: 999.99 } }
  const result = invoiceLayoutBlockSchema.safeParse(maliciousBlock)
  console.log('Rejected (must be true — extra "amount" key is not part of the closed config shape):', !result.success)
  if (!result.success) console.log('Zod error (informational):', result.error.issues.map((i) => i.message).join('; '))
  // Belt-and-suspenders: even if it somehow got through validation, zod object schemas strip
  // unrecognized keys by default, so a "successful" parse would still silently drop `amount`.
  if (result.success) {
    console.log('Even if parse "succeeded", was `amount` stripped from the output (must be true)?', !('amount' in (result.data as any).config))
  }

  console.log('\n========== 4. Dispatcher CAN read/write (admin_dispatcher_all — same as pricing_settings) ==========')
  const { data: dispatcherRead, error: dispatcherReadErr } = await getInvoiceTemplate(dispatcherClient as any, tenantId)
  console.log('Dispatcher read succeeded:', !!dispatcherRead, dispatcherReadErr?.message)

  console.log('\n========== 5. Cross-tenant isolation ==========')
  const { data: tenantB } = await serviceClient
    .from('tenants')
    .insert([{ name: 'Tenant B Invoice Editor DB Test', slug: `tenant-b-invoice-editor-${Date.now()}` }])
    .select()
    .single()
  console.log('Tenant B created:', tenantB!.id)

  // Confirm the trigger auto-provisioned a template for the NEW tenant too.
  const { data: tenantBTemplate } = await serviceClient.from('invoice_templates').select('*').eq('tenant_id', tenantB!.id).single()
  console.log('Tenant B auto-provisioned template (real trigger firing on INSERT INTO tenants):', JSON.stringify(tenantBTemplate, null, 2))

  const { data: crossRead, error: crossReadErr } = await getInvoiceTemplate(adminClient as any, tenantB!.id)
  console.log("\nTenant A session reading Tenant B's template directly by real tenant_id (must be null):", JSON.stringify(crossRead), 'error:', crossReadErr?.message)

  const { data: crossList } = await adminClient.from('invoice_templates').select('id, tenant_id')
  console.log(
    "Tenant A's full visible template list contains Tenant B's row (must be false):",
    (crossList ?? []).some((r: any) => r.tenant_id === tenantB!.id)
  )

  await serviceClient.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nTenant B cleanup complete (invoice_templates row cascade-deleted via ON DELETE CASCADE).')

  console.log('\n========== 6. Restore dev tenant to its original seeded default (cleanup) ==========')
  const originalBlocks = [
    { type: 'header', config: { showLogo: true, alignment: 'left' } },
    { type: 'line_items_table', config: { columns: ['description', 'quantity', 'unit_price', 'amount'] } },
    { type: 'totals_summary', config: { showTaxBreakdown: true } },
    { type: 'terms_text', config: { show: true } },
    { type: 'footer', config: { showPageNumber: true, customText: null } },
  ]
  await updateInvoiceTemplate(adminClient as any, tenantId, invoiceTemplateSchema.parse({ layout_blocks: originalBlocks }).layout_blocks)
  console.log('Restored.')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
