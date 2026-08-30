'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info, Box, Users, Clock } from 'lucide-react'

interface LeadReferenceEstimatesBannerProps {
  estimatedVolume?: number | null
  estimatedHours?: number | null
  estimatedCrewSize?: number | null
}

export function LeadReferenceEstimatesBanner({
  estimatedVolume,
  estimatedHours,
  estimatedCrewSize,
}: LeadReferenceEstimatesBannerProps) {
  const hasVolume = estimatedVolume !== null && estimatedVolume !== undefined
  const hasHours = estimatedHours !== null && estimatedHours !== undefined
  const hasCrew = estimatedCrewSize !== null && estimatedCrewSize !== undefined

  // Strict requirement: If all three are null/empty, render nothing at all (no placeholders, no fake '0')
  if (!hasVolume && !hasHours && !hasCrew) {
    return null
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50 shadow-sm" data-testid="lead-reference-estimates-banner">
      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
            <Info className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-950 text-xs uppercase tracking-wider">
                Lead's Initial Estimate (Reference Context)
              </span>
              <Badge variant="outline" className="text-[10px] font-semibold text-blue-700 border-blue-300 bg-white">
                Intake Guess
              </Badge>
            </div>
            <p className="text-xs text-blue-800 mt-0.5">
              Captured during initial intake. Precise volume and pricing are computed from the itemized inventory below.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {hasVolume && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-xs font-semibold text-blue-900 shadow-2xs">
              <Box className="h-3.5 w-3.5 text-blue-600" />
              <span>~{estimatedVolume} cu ft</span>
            </div>
          )}

          {hasCrew && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-xs font-semibold text-blue-900 shadow-2xs">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              <span>{estimatedCrewSize} crew</span>
            </div>
          )}

          {hasHours && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-blue-200 text-xs font-semibold text-blue-900 shadow-2xs">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              <span>{estimatedHours} hrs</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
