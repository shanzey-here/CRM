'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Clock, Navigation, AlertTriangle, Save } from 'lucide-react'
import { saveQuoteRouteAction } from '../../actions'
import { FullCycleRouteResult } from '@/modules/quotes/server/routing'

export function RouteSummary({
  quoteId,
  quoteStatus,
  originString,
  destinationString,
  initialCalculation,
  savedDistanceMiles,
  savedTimeMinutes,
}: {
  quoteId: string
  quoteStatus: string
  originString: string
  destinationString: string
  initialCalculation: FullCycleRouteResult
  savedDistanceMiles: number | null
  savedTimeMinutes: number | null
}) {
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(
    initialCalculation.hasError && savedDistanceMiles === null
  )

  // Use saved DB values if they exist, otherwise use the calculation
  const defaultMiles = savedDistanceMiles ?? 
    (initialCalculation.totalDistanceMeters ? Math.round(initialCalculation.totalDistanceMeters * 0.000621371) : '')
  const defaultMinutes = savedTimeMinutes ?? 
    (initialCalculation.totalDurationSeconds ? Math.round(initialCalculation.totalDurationSeconds / 60) : '')

  const [distanceMiles, setDistanceMiles] = useState<number | string>(defaultMiles)
  const [timeMinutes, setTimeMinutes] = useState<number | string>(defaultMinutes)

  const isDraft = quoteStatus === 'draft'

  const handleSave = () => {
    if (!isDraft) return

    startTransition(async () => {
      const result = await saveQuoteRouteAction(quoteId, {
        travel_distance_miles: Number(distanceMiles) || 0,
        travel_time_minutes: Number(timeMinutes) || 0,
      })

      if (result.success) {
        setIsEditing(false)
      } else {
        alert(result.error || 'Failed to save route')
      }
    })
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50/50 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Navigation className="h-5 w-5 text-blue-600" /> Route & Distance
            </CardTitle>
            <CardDescription>Full cycle distance (Dispatch &rarr; Pickup &rarr; Delivery &rarr; Return)</CardDescription>
          </div>
          {initialCalculation.hasError && (
            <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> API Error
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Addresses */}
        <div className="space-y-3">
          {initialCalculation.legs && initialCalculation.legs.length > 0 ? (
            initialCalculation.legs.map((leg, idx) => (
              <div key={idx} className="p-3 bg-white border border-slate-100 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {leg.legName}
                  </p>
                  <div className="flex items-center gap-2">
                    {leg.source === 'cache' && (
                      <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200 py-0 h-4">
                        Cached
                      </Badge>
                    )}
                    <span className="text-xs font-medium text-slate-700">
                      {leg.distanceMeters ? Math.round(leg.distanceMeters * 0.000621371) + ' mi' : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-2 text-xs">
                    <div className="w-4 flex justify-center"><div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1" /></div>
                    <p className="text-slate-600 truncate">{leg.originString || 'Unknown'}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                    <p className="text-slate-900 truncate">{leg.destinationString || 'Unknown'}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">
              No route data available.
            </div>
          )}
        </div>

        {/* Fallback / Edit Mode */}
        {isEditing ? (
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg space-y-4 mt-4">
            {initialCalculation.hasError && (
              <div className="text-xs text-red-600 mb-2">
                Google Maps routing failed. Please enter the distance manually.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Distance (Miles)</Label>
                <Input 
                  type="number" 
                  value={distanceMiles} 
                  onChange={(e) => setDistanceMiles(e.target.value)}
                  disabled={!isDraft}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Time (Minutes)</Label>
                <Input 
                  type="number" 
                  value={timeMinutes} 
                  onChange={(e) => setTimeMinutes(e.target.value)}
                  disabled={!isDraft}
                />
              </div>
            </div>
            {isDraft && (
              <div className="flex justify-end gap-2 mt-2">
                {savedDistanceMiles !== null && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save Route'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-6 p-4 bg-slate-50 border border-slate-100 rounded-lg mt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Navigation className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Distance</p>
                <p className="text-lg font-semibold text-slate-900">{distanceMiles} mi</p>
              </div>
            </div>
            
            <div className="w-px h-8 bg-slate-200"></div>
            
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-full">
                <Clock className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Est. Drive Time</p>
                <p className="text-lg font-semibold text-slate-900">{timeMinutes} mins</p>
              </div>
            </div>

            {isDraft && (
              <div className="ml-auto">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
