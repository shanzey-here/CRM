'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'
import { CHART_CHROME } from '@/modules/platform-analytics/colors'

export type NewClientPoint = {
  period: string
  bucket_date: string
  new_clients: number
}

export function NewClientsChart({ 
  data,
  color = '#2563eb', // blue-600
  chartChrome = { grid: '#e2e8f0', axisText: '#64748b' }
}: { 
  data: NewClientPoint[],
  color?: string,
  chartChrome?: { grid: string; axisText: string }
}) {
  const hasAnyData = data.some((d) => d.new_clients > 0)

  if (!hasAnyData) {
    return <div className="flex items-center justify-center h-48 text-sm text-slate-400">No new clients in this period yet.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 24, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chartChrome.grid} />
        <XAxis dataKey="period" tick={{ fill: chartChrome.axisText, fontSize: 12 }} axisLine={{ stroke: chartChrome.grid }} tickLine={false} />
        <YAxis tick={{ fill: chartChrome.axisText, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          formatter={(value: number, name: string) => [`${value}`, name]}
          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
        />
        <Bar dataKey="new_clients" name="New Clients" fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
          <LabelList dataKey="new_clients" position="top" fontSize={11} fill={chartChrome.axisText} formatter={(v: number) => (v > 0 ? v : '')} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
