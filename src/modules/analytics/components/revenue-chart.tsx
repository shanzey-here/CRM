'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, LineChart, Line } from 'recharts'
import { CHART_CHROME } from '@/modules/platform-analytics/colors'

export type RevenuePoint = {
  period: string
  bucket_date: string
  invoiced_revenue: number
  collected_revenue: number
}

function formatGBP(n: number): string {
  if (n === 0) return ''
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n)
}

export function RevenueChart({ 
  data,
  invoicedColor = '#94a3b8', // slate-400
  collectedColor = '#059669', // emerald-600
  chartChrome = { grid: '#e2e8f0', axisText: '#64748b' }
}: { 
  data: RevenuePoint[],
  invoicedColor?: string,
  collectedColor?: string,
  chartChrome?: { grid: string; axisText: string }
}) {
  const hasAnyData = data.some((d) => d.invoiced_revenue > 0 || d.collected_revenue > 0)

  if (!hasAnyData) {
    return <div className="flex items-center justify-center h-64 text-sm text-slate-400">No revenue in this period yet.</div>
  }

  // We use a LineChart to show collected revenue climbing, but dual BarChart is also good.
  // The user requested: "Invoiced vs Collected... clearly distinguishing...".
  // A grouped bar chart works best for comparing two metrics per period.
  
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chartChrome.grid} />
        <XAxis dataKey="period" tick={{ fill: chartChrome.axisText, fontSize: 12 }} axisLine={{ stroke: chartChrome.grid }} tickLine={false} />
        <YAxis tick={{ fill: chartChrome.axisText, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(val) => `£${val}`} />
        <Tooltip
          formatter={(value: number, name: string) => [new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value), name]}
          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: chartChrome.axisText }} />
        <Bar dataKey="invoiced_revenue" name="Invoiced Revenue" fill={invoicedColor} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
        </Bar>
        <Bar dataKey="collected_revenue" name="Collected Revenue" fill={collectedColor} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
          <LabelList dataKey="collected_revenue" position="top" fontSize={11} fill="#0b0b0b" fontWeight={600} formatter={formatGBP} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
