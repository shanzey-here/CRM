import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/types/database.types'
import { createQuote, saveQuoteInventory } from '../src/modules/quotes/server/repository'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

async function runQuoteTests() {
  console.log('--- Starting Quote Repository Tests ---')
  let testTenantId = ''
  let altTenantId = ''
  let testContactId = ''
  let testLeadId = ''
  let item1Id = ''
  let item2Id = ''

  try {
    // 1. Setup Data
    const { data: t1, error: t1Err } = await supabase.from('tenants').insert({ name: 'Quote Test Tenant A', slug: 'test-quote-a-' + Date.now() }).select().single()
    if (t1Err) throw t1Err
    const { data: t2, error: t2Err } = await supabase.from('tenants').insert({ name: 'Quote Test Tenant B', slug: 'test-quote-b-' + Date.now() }).select().single()
    if (t2Err) throw t2Err
    testTenantId = t1.id
    altTenantId = t2.id

    const { data: contact, error: cErr } = await supabase.from('contacts').insert({
      tenant_id: testTenantId,
      first_name: 'Quote',
      last_name: 'Tester',
      email: 'quote@test.com'
    }).select().single()
    if (cErr) throw cErr
    testContactId = contact.id

    const { data: lead, error: lErr } = await supabase.from('leads').insert({
      tenant_id: testTenantId,
      contact_id: testContactId,
      stage: 'inquiry'
    }).select().single()
    if (lErr) throw lErr
    testLeadId = lead.id

    const { data: i1, error: i1Err } = await supabase.from('inventory_items').insert({
      tenant_id: testTenantId,
      name: 'Test Sofa',
      room: 'living_room',
      default_volume: 50
    }).select().single()
    if (i1Err) throw i1Err
    item1Id = i1.id

    const { data: i2, error: i2Err } = await supabase.from('inventory_items').insert({
      tenant_id: testTenantId,
      name: 'Test Box',
      room: 'bedroom',
      default_volume: 5
    }).select().single()
    if (i2Err) throw i2Err
    item2Id = i2.id

    // 2. Test createQuote
    console.log('Testing createQuote...')
    const { data: quote } = await createQuote(supabase, testTenantId, {
      contact_id: testContactId,
      lead_id: testLeadId
    })
    
    if (!quote) throw new Error('Failed to create quote')
    if (quote.status !== 'draft') throw new Error('Quote should start as draft')
    console.log('✅ createQuote success')

    // 3. Test Cross-Tenant Save Protection
    console.log('Testing cross-tenant write protection...')
    const maliciousSave = await saveQuoteInventory(supabase, altTenantId, quote.id, [
      { inventory_item_id: item1Id, room: 'living_room', quantity: 1, item_name: 'Test Sofa', volume: 50 }
    ])
    if (maliciousSave.success) throw new Error('Should have failed to save across tenants')
    console.log('✅ Cross-tenant save blocked')

    // 4. Test Volume Rollup Math
    console.log('Testing volume rollup math...')
    const validSave = await saveQuoteInventory(supabase, testTenantId, quote.id, [
      { inventory_item_id: item1Id, room: 'living_room', quantity: 2, item_name: 'Test Sofa', volume: 50 }, // 100 cft
      { inventory_item_id: item2Id, room: 'bedroom', quantity: 10, item_name: 'Test Box', volume: 5 } // 50 cft
    ])
    if (!validSave.success) throw new Error('Failed to save valid inventory: ' + validSave.error)

    const { data: updatedQuote } = await supabase.from('quotes').select('total_volume').eq('id', quote.id).single()
    if (updatedQuote!.total_volume !== 150) {
      throw new Error(`Rollup failed. Expected 150, got ${updatedQuote!.total_volume}`)
    }
    console.log('✅ Volume rollup correctly calculated 150 cft')

    // 5. Test Mutability Guard (cannot modify sent/accepted quotes)
    console.log('Testing mutability guard...')
    await supabase.from('quotes').update({ status: 'sent' }).eq('id', quote.id)
    const lateSave = await saveQuoteInventory(supabase, testTenantId, quote.id, [])
    if (lateSave.success) throw new Error('Should have failed to save on sent quote')
    if (!lateSave.error?.includes('Quote is no longer a draft')) {
      throw new Error('Expected specific mutability error, got: ' + lateSave.error)
    }
    console.log('✅ Mutability guard correctly rejected write on sent quote')

  } catch (err: any) {
    console.error('❌ Test failed:', err.message)
    process.exit(1)
  } finally {
    // Cleanup
    if (testTenantId) await supabase.from('tenants').delete().eq('id', testTenantId)
    if (altTenantId) await supabase.from('tenants').delete().eq('id', altTenantId)
    console.log('--- Cleanup Complete ---')
  }
}

runQuoteTests()
