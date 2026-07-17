import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getQuoteById, getQuoteInventory } from '@/modules/quotes/server/repository'
import { getActiveInventoryItems } from '@/modules/inventory/server/repository'
import { VolumeCalculator } from './components/volume-calculator'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

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

  // 3. Fetch Quote Inventory (existing selections)
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

      <VolumeCalculator 
        quote={quote}
        initialSelections={selectedInventory || []}
        catalog={catalogItems || []}
      />
    </div>
  )
}
