import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Info } from 'lucide-react'

// Read-only reference panel: the rough figures a lead may already carry from
// intake (Web Widget / manual entry / AI-drafted intake), captured *before*
// any survey or itemised inventory.
//
// AUDIT — why these are shown, never pre-filled into the builder's inputs:
//  - The builder's volume is derived purely from the itemised inventory
//    selection (VolumeCalculator sum, in cubic feet). There is no manual
//    "total volume" input to seed.
//  - `calculate_quote_price` derives labour hours as volume × tenant rate;
//    crew size is not a variable in the pricing engine at all.
//  - `leads.estimated_volume` is entered on the lead form labelled "m³",
//    whereas the builder works in cft — different unit, different origin.
// So a lead estimate and the builder's calculation are NOT the same kind of
// number. These stay visually separate: context for the person building the
// quote, with zero effect on the computed price or saved inventory.
export function LeadEstimateReference({
  estimatedVolume,
  estimatedHours,
  estimatedCrewSize,
}: {
  estimatedVolume: number | null
  estimatedHours: number | null
  estimatedCrewSize: number | null
}) {
  const parts: string[] = []
  if (estimatedVolume !== null) parts.push(`~${estimatedVolume} m³ volume`)
  if (estimatedCrewSize !== null) parts.push(`${estimatedCrewSize} crew`)
  if (estimatedHours !== null) parts.push(`${estimatedHours} hrs`)

  // All three genuinely absent → render nothing (no placeholder, no fabricated 0).
  if (parts.length === 0) return null

  return (
    <Card className="shadow-sm border-slate-200 bg-slate-50/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
          <Info className="h-4 w-4 text-slate-400" /> Lead&apos;s initial estimate
        </CardTitle>
        <CardDescription className="text-xs">
          Recorded at intake, before survey or itemised inventory — reference only. The quote&apos;s
          price and volume are calculated from the inventory and route below, not from this figure.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-slate-800">{parts.join(' · ')}</p>
      </CardContent>
    </Card>
  )
}
