'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { format, isFuture, isPast, isThisMonth } from 'date-fns'
import {
  Search,
  Calendar,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowRight,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ConfirmedBookingItem } from '@/modules/jobs/server/repository'

interface ConfirmedBookingsTableProps {
  initialBookings: ConfirmedBookingItem[]
  unlinkedLeadsCount: number
}

type TimeframeFilter = 'all' | 'upcoming' | 'this_month' | 'past'

export function ConfirmedBookingsTable({
  initialBookings,
  unlinkedLeadsCount,
}: ConfirmedBookingsTableProps) {
  const [search, setSearch] = useState('')
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Calculate metrics
  const stats = useMemo(() => {
    let upcoming = 0
    let completed = 0
    let scheduled = 0

    initialBookings.forEach((b) => {
      if (b.status === 'completed') completed++
      if (b.status === 'scheduled') scheduled++
      if (b.status !== 'completed' && b.status !== 'cancelled') {
        if (!b.move_date || isFuture(new Date(b.move_date)) || format(new Date(b.move_date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
          upcoming++
        }
      }
    })

    return {
      total: initialBookings.length,
      upcoming,
      scheduled,
      completed,
    }
  }, [initialBookings])

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return initialBookings.filter((job) => {
      // 1. Timeframe filter
      if (timeframe === 'upcoming') {
        if (job.status === 'completed' || job.status === 'cancelled') return false
        if (!job.move_date) return true // TBD scheduled moves are considered upcoming
        const moveDate = new Date(job.move_date)
        const isUpcomingDate =
          isFuture(moveDate) ||
          format(moveDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
        if (!isUpcomingDate) return false
      } else if (timeframe === 'this_month') {
        if (!job.move_date) return false
        if (!isThisMonth(new Date(job.move_date))) return false
      } else if (timeframe === 'past') {
        if (!job.move_date) return false
        const moveDate = new Date(job.move_date)
        const isPastDate =
          isPast(moveDate) &&
          format(moveDate, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd')
        if (!isPastDate) return false
      }

      // 2. Status filter
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false
      }

      // 3. Search query
      if (search.trim()) {
        const q = search.toLowerCase()
        const customerName = `${job.contact?.first_name || ''} ${job.contact?.last_name || ''}`.toLowerCase()
        const customerEmail = (job.contact?.email || '').toLowerCase()
        const customerPhone = (job.contact?.phone || '').toLowerCase()
        const jobNumber = `JOB-${job.id.slice(0, 8).toUpperCase()}`.toLowerCase()
        const originCity = (job.origin_address?.city || '').toLowerCase()
        const destCity = (job.destination_address?.city || '').toLowerCase()
        const quoteNum = job.quote ? `Q-${job.quote.id.slice(0, 8).toUpperCase()}`.toLowerCase() : ''

        return (
          customerName.includes(q) ||
          customerEmail.includes(q) ||
          customerPhone.includes(q) ||
          jobNumber.includes(q) ||
          originCity.includes(q) ||
          destCity.includes(q) ||
          quoteNum.includes(q)
        )
      }

      return true
    })
  }, [initialBookings, timeframe, statusFilter, search])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
            <Clock className="w-3 h-3 mr-1" />
            Scheduled
          </Badge>
        )
      case 'in_progress':
        return (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
            <Truck className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        )
      case 'completed':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="capitalize">
            {status.replace('_', ' ')}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Stat Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Confirmed
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1" data-testid="stat-total-confirmed">
              {stats.total}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Upcoming Moves
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1" data-testid="stat-upcoming-moves">
              {stats.upcoming}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Completed Moves
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1" data-testid="stat-completed-moves">
              {stats.completed}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Discrepancy Notice for Unlinked Pipeline Leads */}
      {unlinkedLeadsCount > 0 && (
        <div
          role="status"
          className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3"
          data-testid="unlinked-leads-notice"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Pipeline Notice: {unlinkedLeadsCount} {unlinkedLeadsCount === 1 ? 'lead' : 'leads'} in &quot;Confirmed Booking&quot; pipeline stage without a scheduled operational job.
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These leads were moved across pipeline columns in the sales funnel, but have not had a job record generated yet.
            </p>
          </div>
          <Link
            href="/office/leads"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200/80 px-3 py-1.5 rounded-lg transition-colors shrink-0"
          >
            <span>View Leads Pipeline</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Controls & Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Timeframe Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setTimeframe('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              timeframe === 'all'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="filter-timeframe-all"
          >
            All Bookings
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('upcoming')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              timeframe === 'upcoming'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="filter-timeframe-upcoming"
          >
            Upcoming Moves
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('this_month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              timeframe === 'this_month'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="filter-timeframe-this-month"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('past')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              timeframe === 'past'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            data-testid="filter-timeframe-past"
          >
            Past Moves
          </button>
        </div>

        {/* Search & Status Controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, job #, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="bookings-search-input"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="bookings-status-select"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="confirmed-bookings-table">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-6 py-3.5">Move Date & Time</th>
                <th className="px-6 py-3.5">Job Number</th>
                <th className="px-6 py-3.5">Customer Contact</th>
                <th className="px-6 py-3.5">Route</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Quote / Value</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBookings.length > 0 ? (
                filteredBookings.map((job) => {
                  const moveDateFormatted = job.move_date
                    ? format(new Date(job.move_date), 'MMM d, yyyy')
                    : 'TBD'

                  const originText = job.origin_address
                    ? `${job.origin_address.city || ''} ${job.origin_address.postcode || ''}`.trim() || 'Origin set'
                    : 'Origin TBD'

                  const destText = job.destination_address
                    ? `${job.destination_address.city || ''} ${job.destination_address.postcode || ''}`.trim() || 'Dest set'
                    : 'Destination TBD'

                  const jobRef = `JOB-${job.id.slice(0, 8).toUpperCase()}`
                  const quoteRef = job.quote ? `Q-${job.quote.id.slice(0, 8).toUpperCase()}` : null

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                      data-testid={`booking-row-${job.id}`}
                    >
                      {/* Move Date */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="font-semibold text-slate-900">
                              {moveDateFormatted}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Job Number */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {jobRef}
                        </span>
                      </td>

                      {/* Customer Contact */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {job.contact?.first_name} {job.contact?.last_name || ''}
                          </p>
                          {job.contact?.phone && (
                            <p className="text-[11px] text-slate-500">
                              {job.contact.phone}
                            </p>
                          )}
                          {job.contact?.email && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                              {job.contact.email}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Route */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[120px]" title={originText}>
                            {originText}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                          <span className="truncate max-w-[120px]" title={destText}>
                            {destText}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(job.status)}
                      </td>

                      {/* Value / Quote */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {job.quote?.total_price ? (
                          <div>
                            <p className="font-semibold text-slate-900">
                              £{Number(job.quote.total_price).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {quoteRef}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Direct Job</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/office/jobs/${job.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                          data-testid={`view-job-link-${job.id}`}
                        >
                          <span>View Details</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Truck className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-700">No confirmed bookings found</p>
                      <p className="text-xs text-slate-400">
                        {search || statusFilter !== 'all' || timeframe !== 'all'
                          ? 'Try adjusting your filters or search terms.'
                          : 'Confirmed moves and accepted quotes will appear here automatically.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
