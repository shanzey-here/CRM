import { Metadata } from 'next'
import { ConversionFunnel } from '@/modules/analytics/components/conversion-funnel'
import { RepeatCustomersList } from '@/modules/analytics/components/repeat-customers-list'

export const metadata: Metadata = {
  title: 'Reports & Analytics | GoMove CRM',
}

export default function ReportsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Reports & Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Business performance and conversion tracking.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column (Main Stats) */}
        <div className="lg:col-span-2 space-y-8">
          <ConversionFunnel />
        </div>

        {/* Right Column (Lists) */}
        <div className="lg:col-span-1 space-y-8">
          <RepeatCustomersList />
        </div>
      </div>
    </div>
  )
}
