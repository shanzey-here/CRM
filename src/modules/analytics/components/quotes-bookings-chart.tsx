'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
export type QuoteBookingPoint = {
  period: string
  quotesSent: number
  confirmedBookings: number
  conversionRate: number | null
}

function formatPercent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

// One grouped bar chart, not two separate charts and not a dual-axis combo —
// unlike the tenant-growth chart's pairing (a per-period count vs a
// cumulative total, genuinely different scales), Quotes Sent and Confirmed
// Bookings are both real per-period counts on the same scale, so one shared
// axis is honest here. Conversion rate is a third, different-scale quantity
// (a percentage) — never plotted on the same axis, only shown as a direct
// label per period.
export function QuotesBookingsChart({ 
  data,
  countColor = '#2563eb',
  revenueColor = '#059669',
  chartChrome = { grid: '#e2e8f0', axisText: '#64748b' }
}: { 
  data: QuoteBookingPoint[],
  countColor?: string,
  revenueColor?: string,
  chartChrome?: { grid: string; axisText: string }
}) {
  const hasAnyData = data.some((d) => d.quotesSent > 0 || d.confirmedBookings > 0)

  if (!hasAnyData) {
    return <div className="flex items-center justify-center h-48 text-sm text-slate-400">No quotes in this period yet.</div>
  }

  // Precomputed as a plain string field read via LabelList's own `dataKey`
  // (entry.payload lookup), not a custom content function reading
  // props.index — confirmed by a real render that props.index is NOT
  // reliable here: with two Bar series sharing one chart and the first
  // period's confirmedBookings at 0, recharts' index enumeration for this
  // series skewed by one, silently showing one period's conversion rate
  // under the next period's bar. dataKey-based extraction reads the
  // correct underlying data point regardless of that skew.
  const chartData = data.map((d) => ({ ...d, conversionRateLabel: formatPercent(d.conversionRate) }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chartChrome.grid} />
        <XAxis dataKey="period" tick={{ fill: chartChrome.axisText, fontSize: 12 }} axisLine={{ stroke: chartChrome.grid }} tickLine={false} />
        <YAxis tick={{ fill: chartChrome.axisText, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          formatter={(value: number, name: string) => [`${value}`, name]}
          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: chartChrome.axisText }} />
        <Bar dataKey="quotesSent" name="Quotes sent" fill={countColor} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
          <LabelList dataKey="quotesSent" position="top" fontSize={11} fill={chartChrome.axisText} formatter={(v: number) => (v > 0 ? v : '')} />
        </Bar>
        <Bar dataKey="confirmedBookings" name="Confirmed bookings" fill={revenueColor} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
          <LabelList dataKey="conversionRateLabel" position="top" fontSize={11} fill="#0b0b0b" fontWeight={600} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
