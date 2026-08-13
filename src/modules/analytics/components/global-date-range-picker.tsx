'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { format, subDays, parseISO, isValid } from 'date-fns'
import { useCallback, useEffect, useState } from 'react'

export function GlobalDateRangePicker() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const defaultStart = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  const defaultEnd = format(new Date(), 'yyyy-MM-dd')

  const initialStart = searchParams.get('startDate') || defaultStart
  const initialEnd = searchParams.get('endDate') || defaultEnd

  const [startDate, setStartDate] = useState(initialStart)
  const [endDate, setEndDate] = useState(initialEnd)

  const applyRange = useCallback((start: string, end: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('startDate', start)
    params.set('endDate', end)
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  // Sync internal state if URL changes (e.g. back button)
  useEffect(() => {
    setStartDate(searchParams.get('startDate') || defaultStart)
    setEndDate(searchParams.get('endDate') || defaultEnd)
  }, [searchParams, defaultStart, defaultEnd])

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setStartDate(val)
    if (isValid(parseISO(val))) {
      applyRange(val, endDate)
    }
  }

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setEndDate(val)
    if (isValid(parseISO(val))) {
      applyRange(startDate, val)
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm bg-card p-1.5 rounded-lg border border-border shadow-sm">
      <input
        type="date"
        value={startDate}
        onChange={handleStartChange}
        className="rounded-md border-0 bg-transparent text-foreground focus:ring-2 focus:ring-emerald-500 sm:text-sm py-1.5 px-3"
      />
      <span className="text-muted-foreground font-medium px-1">to</span>
      <input
        type="date"
        value={endDate}
        onChange={handleEndChange}
        className="rounded-md border-0 bg-transparent text-foreground focus:ring-2 focus:ring-emerald-500 sm:text-sm py-1.5 px-3"
      />
    </div>
  )
}
