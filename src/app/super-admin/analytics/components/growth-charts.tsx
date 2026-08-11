'use client'

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts'
import { COUNT_COLOR, CHART_CHROME } from '@/modules/platform-analytics/colors'
import type { GrowthPoint } from '@/modules/platform-analytics/server/repository'

// Two separate, clearly-titled charts — never a dual-axis combo (the
// skill's #1 anti-pattern: two different jobs, velocity vs trajectory,
// don't share one scale honestly).
export function GrowthCharts({ data }: { data: GrowthPoint[] }) {
  const hasAnyData = data.some((d) => d.newTenants > 0) || (data[0]?.cumulativeTotal ?? 0) > 0

  if (!hasAnyData) {
    return <div className="flex items-center justify-center h-48 text-sm text-slate-400">No signups in this period yet.</div>
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">New signups per period</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
            <XAxis dataKey="period" tick={{ fill: CHART_CHROME.axisText, fontSize: 12 }} axisLine={{ stroke: CHART_CHROME.grid }} tickLine={false} />
            <YAxis tick={{ fill: CHART_CHROME.axisText, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={(value: number) => [`${value} new tenants`, '']} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="newTenants" fill={COUNT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24}>
              <LabelList dataKey="newTenants" position="top" fontSize={11} fill={CHART_CHROME.axisText} formatter={(v: number) => (v > 0 ? v : '')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Cumulative total tenants</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 16, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
            <XAxis dataKey="period" tick={{ fill: CHART_CHROME.axisText, fontSize: 12 }} axisLine={{ stroke: CHART_CHROME.grid }} tickLine={false} />
            <YAxis tick={{ fill: CHART_CHROME.axisText, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={(value: number) => [`${value} tenants total`, '']} />
            <Line
              type="monotone"
              dataKey="cumulativeTotal"
              stroke={COUNT_COLOR}
              strokeWidth={2}
              dot={{ r: 3, fill: COUNT_COLOR }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="cumulativeTotal"
                position="top"
                fontSize={11}
                fill={CHART_CHROME.axisText}
                content={(props: any) => {
                  // Selective direct label — only the last point, per the
                  // skill's "label the endpoint" rule, not every point.
                  // Recharts' Line->LabelList strips `payload` (it's not a
                  // valid SVG attribute, filtered out by svgPropertiesAndEvents)
                  // but does explicitly forward `index` — confirmed by reading
                  // recharts' own LabelList/Line source, not assumed.
                  if (props.index !== data.length - 1) return null
                  return (
                    <text x={props.x} y={props.y - 8} fontSize={11} fill="#0b0b0b" textAnchor="middle" fontWeight={600}>
                      {props.value}
                    </text>
                  )
                }}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
