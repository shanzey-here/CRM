import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getQuoteById, getQuoteInventory } from '@/modules/quotes/server/repository'
import { getActiveInventoryItems } from '@/modules/inventory/server/repository'
import { getLeadById } from '@/modules/leads/server/repository'
import { getAddressById } from '@/modules/clients/server/repository'
import { calculateFullCycleRoute, FullCycleRouteResult } from '@/modules/quotes/server/routing'
import { VolumeCalculator } from './components/volume-calculator'
import { RouteSummary } from './components/route-summary'
import { LeadReferenceEstimatesBanner } from './components/lead-reference-estimates-banner'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const dynamic = 'force-dynamic'

export default async function QuoteWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const supabase = await createClient()

  // 1. Authenticate and enforce Tenant Context
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }
  const tenantId = user.app_metadata.tenant_id

  // 2. Fetch Quote
  const { data: quote, error: quoteError } = await getQuoteById(supabase, tenantId, id)
  if (quoteError || !quote) {
    notFound()
  }

  // 3. Fetch Lead & Addresses & Route Calculation
  let originAddress = null
  let destinationAddress = null
  let routeCalc: FullCycleRouteResult = { totalDistanceMeters: null, totalDurationSeconds: null, legs: [], hasError: true }
  let originString = ''
  let destinationString = ''
  let leadRecord: any = null

  if (quote.lead_id) {
    const { data: lead } = await getLeadById(supabase, tenantId, quote.lead_id)
    if (lead) {
      leadRecord = lead
      if (lead.origin_address_id) {
        const { data } = await getAddressById(supabase, tenantId, lead.origin_address_id)
        originAddress = data
        if (data) {
          originString = [data.line_1, data.city, data.postcode].filter(Boolean).join(', ')
        }
      }
      if (lead.destination_address_id) {
        const { data } = await getAddressById(supabase, tenantId, lead.destination_address_id)
        destinationAddress = data
        if (data) {
          destinationString = [data.line_1, data.city, data.postcode].filter(Boolean).join(', ')
        }
      }

      if (originAddress && destinationAddress) {
        routeCalc = await calculateFullCycleRoute(supabase, tenantId, originAddress, destinationAddress)
      }
    }
  }

  // 4. Fetch Quote Inventory (existing selections)
  const { data: selectedInventory } = await getQuoteInventory(supabase, tenantId, id)

  // 4. Fetch the master catalog
  // We need to fetch active items, PLUS any inactive items that are currently selected in this quote.
  const { data: catalogItems } = await getActiveInventoryItems(supabase, tenantId)
  
  // NOTE: If soft-deleted items exist in `selectedInventory`, we would need to fetch them. 
  // However, the `quote_inventory` table stores `item_name` and `volume` snapshots, so we only 
  // need the catalog items to let the user add NEW items or modify quantities of existing ACTIVE items.
  // Soft-deleted items on old quotes will just render using their snapshot data in the right-pane summary.

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/office/leads/${quote.lead_id}`}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                Quote Workspace
              </h1>
              <Badge variant="outline" className="uppercase text-xs font-semibold">
                {quote.status}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Ref: #{quote.id.split('-')[0]}
            </p>
          </div>
        </div>
      </div>

      <LeadReferenceEstimatesBanner
        estimatedVolume={leadRecord?.estimated_volume}
        estimatedHours={leadRecord?.estimated_hours}
        estimatedCrewSize={leadRecord?.estimated_crew_size}
      />

      <RouteSummary
        quoteId={quote.id}
        quoteStatus={quote.status}
        originString={originString}
        destinationString={destinationString}
        initialCalculation={routeCalc}
        savedDistanceMiles={quote.travel_distance_miles}
        savedTimeMinutes={quote.travel_time_minutes}
      />

      <VolumeCalculator
        quote={quote}
        initialSelections={selectedInventory || []}
        catalog={catalogItems || []}
      />

      {/* Read-only pricing snapshot — whatever calculateQuotePrice() last
          persisted onto this quote. Negotiated rates are never silent: when
          negotiated_discount_percent is set, both the standard and
          negotiated figures are shown, never just the smaller number. */}
      {quote.computed_price !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quote.negotiated_discount_percent !== null && quote.standard_price !== null ? (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Standard Price</span>
                  <span className="font-medium text-slate-400 line-through">{formatCurrency(quote.standard_price)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Negotiated Rate</span>
                  <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                    {Number(quote.negotiated_discount_percent).toFixed(2)}% off
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Final Price</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(quote.computed_price)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Computed Price</span>
                <span className="font-medium">{formatCurrency(quote.computed_price)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <SendQuoteButton
        quoteId={quote.id}
        leadId={quote.lead_id}
        quoteStatus={quote.status}
        publicToken={quote.public_token}
        hasPricing={quote.computed_price !== null}
      />
    </div>
  )
}
