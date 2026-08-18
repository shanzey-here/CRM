'use client'

import { Card, CardContent } from '@/components/ui/card'

interface CrateStatsProps {
  total: number
  available: number
  inUse: number
  billingIssues: number
}

export function CrateStatsMatrix({ stats }: { stats: CrateStatsProps }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium text-slate-500">Total Crates</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-slate-900">{stats.total}</p>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium text-slate-500">Available</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-emerald-600">{stats.available}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium text-slate-500">With Customer</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-blue-600">{stats.inUse}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium text-slate-500">Billing Issues</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className={`text-3xl font-semibold ${stats.billingIssues > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {stats.billingIssues}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
