'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { CHART_CHROME } from '@/modules/platform-analytics/colors'

type Entry = { name: string; value: number; total: number }

// `format` is a serializable enum, not a function — this component is
// 'use client' and its props cross the Server->Client RSC boundary, which
// cannot carry function values (e.g. a page.tsx-defined valueFormatter).
type Format = 'count' | 'currency-gbp'

function formatValue(n: number, format: Format): string {
  if (format === 'currency-gbp') {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n)
  }
  return `${n} tenant${n === 1 ? '' : 's'}`
}

export function HorizontalBarChart({
  data,
  color,
  format,
  emptyLabel,
}: {
  data: Entry[]
  color: string
  format: Format
  emptyLabel: string
}) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-sm text-slate-400">{emptyLabel}</div>
  }

  const height = Math.max(120, data.length * 44)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 110, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} />
        <XAxis type="number" tick={{ fill: CHART_CHROME.axisText, fontSize: 12 }} axisLine={{ stroke: CHART_CHROME.grid }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fill: CHART_CHROME.axisText, fontSize: 13 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(value: number) => formatValue(value, format)} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={24}>
          <LabelList
            dataKey="value"
            position="right"
            formatter={(value: number) => value}
            content={(props: any) => {
              const { x, y, width, height: barHeight, value, index } = props
              const entry = data[index]
              const pct = entry.total > 0 ? Math.round((entry.value / entry.total) * 100) : 0
              return (
                <text x={x + width + 8} y={y + barHeight / 2} dy={4} fontSize={12} fill="#475569">
                  {formatValue(value, format)} ({pct}%)
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
