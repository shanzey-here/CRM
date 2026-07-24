import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createQuote, saveQuoteInventory } from '../../src/modules/quotes/server/repository'
import { getRouteDetails } from '../../src/modules/quotes/server/routing'
import { calculateQuotePrice, savePricingCalculation } from '../../src/modules/quotes/server/pricing'

const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'
const CONTACT_ID = 'c3bbda6a-4e5f-491a-ab9b-825c54bc51a4'
const ORIGIN_ADDRESS_ID = '85f43c61-0e30-4bfb-a32c-d43a91e2719f'
const DEST_ADDRESS_ID = '7e43584e-02c6-477e-ac81-c4470e013859'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('=== Manually driving the SAME steps a dispatcher would (createQuoteAction -> saveQuoteRouteAction -> saveQuoteInventoryAction), then calling the same unmodified calculateQuotePrice() ===\n')

  // 1. Create quote — same repository function createQuoteAction uses.
  const { data: quote, error: quoteErr } = await createQuote(supabase, TENANT_ID, { contact_id: CONTACT_ID })
  if (quoteErr || !quote) throw new Error(`createQuote failed: ${quoteErr?.message}`)
  console.log('Created manual-comparison quote:', quote.id)

  // 2. Same addresses the AI quote used (Manchester -> Leeds), fetched via
  // the same getRouteDetails() the manual quote page uses.
  const { data: origin } = await supabase.from('addresses').select('*').eq('id', ORIGIN_ADDRESS_ID).single()
  const { data: destination } = await supabase.from('addresses').select('*').eq('id', DEST_ADDRESS_ID).single()
  const route = await getRouteDetails(supabase, TENANT_ID, origin!, destination!)
  console.log('Route (should hit cache from the AI run):', route)

  await supabase
    .from('quotes')
    .update({
      travel_distance_miles: Math.round(route.distanceMeters! * 0.000621371),
      travel_time_minutes: route.durationSeconds ? Math.round(route.durationSeconds / 60) : null,
    })
    .eq('id', quote.id)
    .eq('tenant_id', TENANT_ID)

  // 3. Same items as the AI quote: Queen Bed, Sofa, Dining Table (real
  // catalog rows), via saveQuoteInventory() — the same repository function
  // saveQuoteInventoryAction uses.
  const items = [
    { inventory_item_id: '5f1de01f-92ca-46cc-9def-b509af2ef96d', room: 'bedroom' as const, quantity: 1, item_name: 'Queen Bed', volume: 35 },
    { inventory_item_id: '06bb4d3b-825e-412d-a8df-5788d7ba8508', room: 'living_room' as const, quantity: 1, item_name: 'Sofa', volume: 45 },
    { inventory_item_id: 'da0b84cb-1fab-4a71-9bf2-564ea91673ee', room: 'dining_room' as const, quantity: 1, item_name: 'Dining Table', volume: 20 },
  ]
  const invResult = await saveQuoteInventory(supabase, TENANT_ID, quote.id, items)
  console.log('saveQuoteInventory result:', invResult)

  const { data: refreshed } = await supabase.from('quotes').select('total_volume').eq('id', quote.id).single()
  console.log('total_volume after saveQuoteInventory:', refreshed?.total_volume)

  // 4. The exact same, unmodified pricing engine call.
  const pricingResult = await calculateQuotePrice(supabase, {
    tenantId: TENANT_ID,
    quoteId: quote.id,
    totalVolume: refreshed!.total_volume ?? 0,
    distanceMeters: route.distanceMeters!,
    selectedSurcharges: [],
  })
  console.log('\ncalculateQuotePrice result (manual-flow quote):', JSON.stringify(pricingResult, null, 2))

  if (pricingResult.success && pricingResult.result) {
    await savePricingCalculation(supabase, TENANT_ID, quote.id, pricingResult.result.computedPrice, [], pricingResult.result.breakdown)
  }

  console.log('\n=== COMPARISON ===')
  console.log('AI-created quote (dfbeab12-9490-442a-acb9-f8cf0b9913fe) computed_price: 1103.03')
  console.log('Manual-flow quote (' + quote.id + ') computed_price:', pricingResult.result?.computedPrice)
}
main().catch((err) => console.error('FAILED:', err))
