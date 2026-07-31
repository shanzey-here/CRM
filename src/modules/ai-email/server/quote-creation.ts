import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { createAddress } from '@/modules/clients/server/repository'
import { createLead } from '@/modules/leads/server/repository'
import { createQuote, saveQuoteInventory } from '@/modules/quotes/server/repository'
import { getRouteDetails } from '@/modules/quotes/server/routing'
import { calculateQuotePrice, savePricingCalculation } from '@/modules/quotes/server/pricing'
import { findOrCreateContactByEmail } from './contact-resolution'
import { CatalogEntry } from './extract'
import { ExtractResult } from '../provider/types'

export type QuoteCreationResult =
  | { success: true; quoteId: string; computedPrice: number }
  | { success: false; error: string }

// The full sequence, per the plan: contact -> addresses -> lead -> thread
// link -> quote -> inventory -> route -> price. Only ever called once
// extraction has already been confirmed complete (isExtractionComplete()) —
// this function does not itself re-validate completeness, it trusts the
// caller already gated on it.
export async function createQuoteFromExtraction(
  serviceClient: SupabaseClient<Database>,
  {
    tenantId,
    threadId,
    senderEmail,
    senderName,
    extraction,
    catalog,
  }: {
    tenantId: string
    threadId: string
    senderEmail: string
    senderName: string
    extraction: ExtractResult
    catalog: CatalogEntry[]
  }
): Promise<QuoteCreationResult> {
  // 1. Find-or-create contact.
  const { data: contact, error: contactErr } = await findOrCreateContactByEmail(serviceClient, tenantId, {
    email: senderEmail,
    fallbackFirstName: senderName,
  })
  if (contactErr || !contact) return { success: false, error: `Failed to resolve contact: ${contactErr?.message}` }

  // 2. Create addresses.
  const { data: originAddress, error: originErr } = await createAddress(serviceClient, tenantId, {
    line_1: extraction.origin.line1,
    city: extraction.origin.city,
    postcode: extraction.origin.postcode,
    country: 'GB',
  })
  if (originErr || !originAddress) return { success: false, error: `Failed to create origin address: ${originErr?.message}` }

  const { data: destinationAddress, error: destErr } = await createAddress(serviceClient, tenantId, {
    line_1: extraction.destination.line1,
    city: extraction.destination.city,
    postcode: extraction.destination.postcode,
    country: 'GB',
  })
  if (destErr || !destinationAddress) return { success: false, error: `Failed to create destination address: ${destErr?.message}` }

  // 3. Create lead — the functional reason: this is the only place in the
  // schema origin/destination addresses can attach for getRouteDetails().
  const { data: lead, error: leadErr } = await createLead(serviceClient, tenantId, {
    contact_id: contact.id,
    stage: 'inquiry',
    source: 'ai_email',
    origin_address_id: originAddress.id,
    destination_address_id: destinationAddress.id,
  })
  if (leadErr || !lead) return { success: false, error: `Failed to create lead: ${leadErr?.message}` }

  // 4. Link the thread — both predicates, matching every other service-role
  // write in this project (never a single .eq('id', ...) alone).
  const { error: linkErr } = await serviceClient
    .from('email_threads')
    .update({ contact_id: contact.id, lead_id: lead.id })
    .eq('id', threadId)
    .eq('tenant_id', tenantId)
  if (linkErr) return { success: false, error: `Failed to link thread: ${linkErr.message}` }

  // 5. Create the quote.
  const { data: quote, error: quoteErr } = await createQuote(serviceClient, tenantId, {
    contact_id: contact.id,
    lead_id: lead.id,
  })
  if (quoteErr || !quote) return { success: false, error: `Failed to create quote: ${quoteErr?.message}` }

  // 6. Populate inventory — item_name/volume always read back from the real
  // catalog row, never trusted from the extraction itself.
  const catalogById = new Map(catalog.map((c) => [c.id, c]))
  const inventoryItems = extraction.items
    .map((item) => {
      const catalogItem = catalogById.get(item.inventoryItemId)
      if (!catalogItem) return null
      return {
        inventory_item_id: catalogItem.id,
        room: (catalogItem.room ?? 'other') as any,
        quantity: item.quantity,
        item_name: catalogItem.name,
        volume: catalogItem.default_volume,
      }
    })
    .filter((i): i is NonNullable<typeof i> => i !== null)

  const inventoryResult = await saveQuoteInventory(serviceClient, tenantId, quote.id, inventoryItems)
  if (!inventoryResult.success) return { success: false, error: `Failed to save inventory: ${inventoryResult.error}` }

  // 7. Real distance — same cache-backed function the manual quote page uses.
  const route = await getRouteDetails(serviceClient, tenantId, originAddress, destinationAddress)
  if (route.distanceMeters === null) return { success: false, error: 'Failed to compute route distance' }

  const { error: routeUpdateErr } = await serviceClient
    .from('quotes')
    .update({
      travel_distance_miles: Math.round(route.distanceMeters * 0.000621371),
      travel_time_minutes: route.durationSeconds ? Math.round(route.durationSeconds / 60) : null,
    })
    .eq('id', quote.id)
    .eq('tenant_id', tenantId)
  if (routeUpdateErr) return { success: false, error: `Failed to save route: ${routeUpdateErr.message}` }

  // 8. Read back the server-computed total_volume (set by save_quote_inventory).
  const { data: refreshedQuote, error: refreshErr } = await serviceClient
    .from('quotes')
    .select('total_volume')
    .eq('id', quote.id)
    .eq('tenant_id', tenantId)
    .single()
  if (refreshErr || !refreshedQuote) return { success: false, error: `Failed to read back quote volume: ${refreshErr?.message}` }

  // 9. Real, unmodified pricing engine call — distanceMeters passed directly
  // from step 7, never re-derived from the stored miles column.
  const pricingResult = await calculateQuotePrice(serviceClient, {
    tenantId,
    quoteId: quote.id,
    contactId: contact.id,
    totalVolume: refreshedQuote.total_volume ?? 0,
    distanceMeters: route.distanceMeters,
    selectedSurcharges: [],
  })
  if (!pricingResult.success || !pricingResult.result) {
    return { success: false, error: `Pricing calculation failed: ${pricingResult.error}` }
  }

  const saveResult = await savePricingCalculation(
    serviceClient,
    tenantId,
    quote.id,
    pricingResult.result.computedPrice,
    [],
    pricingResult.result.breakdown
  )
  if (!saveResult.success) return { success: false, error: `Failed to save pricing: ${saveResult.error}` }

  return { success: true, quoteId: quote.id, computedPrice: pricingResult.result.computedPrice }
}
