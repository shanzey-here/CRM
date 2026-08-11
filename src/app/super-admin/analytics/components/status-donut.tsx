'use client'

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { STATUS_COLORS, STATUS_LABELS } from '@/modules/platform-analytics/colors'
import type { TenantStatusKey } from '@/modules/platform-analytics/server/repository'

export function StatusDonut({ countsByStatus }: { countsByStatus: Record<TenantStatusKey, number> }) {
  const total = Object.values(countsByStatus).reduce((sum, n) => sum + n, 0)
  const data = (Object.keys(countsByStatus) as TenantStatusKey[])
    .map((key) => ({ key, name: STATUS_LABELS[key], value: countsByStatus[key] }))
    .filter((d) => d.value > 0)

  if (total === 0) {
    return <div className="flex items-center justify-center h-64 text-sm text-slate-400">No tenants yet.</div>
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <ResponsiveContainer width="100%" height={260} className="max-w-xs">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
            // Direct labels on every slice — never hover-only.
            label={({ name, value, percent }) => `${name} ${value} (${Math.round((percent ?? 0) * 100)}%)`}
            labelLine
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} stroke="#fcfcfb" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [`${value} tenants`, name]} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend, always present for >=2 series */}
      <ul className="space-y-1.5 text-sm">
        {data.map((entry) => (
          <li key={entry.key} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[entry.key] }} />
            <span className="text-slate-700">{entry.name}</span>
            <span className="text-slate-400">
              {entry.value} · {Math.round((entry.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
