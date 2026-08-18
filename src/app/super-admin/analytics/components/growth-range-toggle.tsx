'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const OPTIONS = [3, 6, 12]

export function GrowthRangeToggle({ activeMonths }: { activeMonths: number }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setMonths(months: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('months', String(months))
    router.push(`/super-admin/analytics?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1">
      {OPTIONS.map((m) => (
        <button
          key={m}
          onClick={() => setMonths(m)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            activeMonths === m ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          {m}mo
        </button>
      ))}
    </div>
  )
}
