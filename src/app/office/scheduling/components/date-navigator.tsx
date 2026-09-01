'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { format, parseISO, addWeeks, addDays, startOfWeek, subWeeks, subDays, isValid } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function DateNavigator({ currentDate, range }: { currentDate: string, range: 'week' | 'day' }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const dateObj = parseISO(currentDate)

  const handleNext = () => {
    const nextDate = range === 'week' ? addWeeks(dateObj, 1) : addDays(dateObj, 1)
    updateUrl(nextDate, range)
  }

  const handlePrev = () => {
    const prevDate = range === 'week' ? subWeeks(dateObj, 1) : subDays(dateObj, 1)
    updateUrl(prevDate, range)
  }

  const handleToday = () => {
    updateUrl(new Date(), range)
  }

  const handleRangeChange = (newRange: 'week' | 'day') => {
    updateUrl(dateObj, newRange)
  }

  const updateUrl = (date: Date, newRange: 'week' | 'day') => {
    const params = new URLSearchParams(searchParams.toString())
    // For week, align to week start, otherwise just the date
    const d = newRange === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : date
    params.set('date', format(d, 'yyyy-MM-dd'))
    if (newRange !== 'week') {
      params.set('range', newRange)
    } else {
      params.delete('range')
    }
    router.push(`?${params.toString()}`)
  }

  let dateLabel = ''
  if (range === 'week') {
    const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 })
    const weekEnd = addDays(weekStart, 6)
    dateLabel = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
  } else {
    dateLabel = format(dateObj, 'MMM d, yyyy')
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center bg-white rounded-md border border-slate-200 p-0.5">
        <button
          onClick={() => handleRangeChange('week')}
          className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
            range === 'week' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Week
        </button>
        <button
          onClick={() => handleRangeChange('day')}
          className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${
            range === 'day' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Day
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={handleToday}>
          Today
        </Button>
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handlePrev}
            title="Previous period"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={handleNext}
            title="Next period"
            aria-label="Next period"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="text-sm font-medium text-slate-900">
        {dateLabel}
      </div>
    </div>
  )
}
