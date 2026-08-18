'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const TABS = [
  { key: 'revenue', label: 'Revenue & Growth' },
  { key: 'health', label: 'Health' },
] as const

export type AnalyticsTabKey = (typeof TABS)[number]['key']

// Same searchParams-driven navigation pattern as GrowthRangeToggle — keeps
// the page server-rendered and bookmarkable rather than client-only tab state.
export function AnalyticsTabs({ activeTab }: { activeTab: AnalyticsTabKey }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setTab(tab: AnalyticsTabKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    if (tab !== 'revenue') params.delete('months')
    router.push(`/super-admin/analytics?${params.toString()}`)
  }

  return (
    <div className="border-b border-slate-200 flex items-center gap-1">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === t.key
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
