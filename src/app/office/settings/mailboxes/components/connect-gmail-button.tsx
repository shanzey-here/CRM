'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'

interface Brand {
  id: string
  name: string
  is_default: boolean
}

export function ConnectGmailButton({ brands }: { brands: Brand[] }) {
  const defaultBrandId = brands.find((b) => b.is_default)?.id ?? brands[0]?.id
  const [brandId, setBrandId] = useState(defaultBrandId)

  const href = brandId ? `/api/oauth/gmail/start?brand=${brandId}` : '/api/oauth/gmail/start'

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <a
        href={href}
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
      >
        <Mail className="h-4 w-4" />
        Connect Gmail
      </a>
      {brands.length > 1 && (
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="text-sm border border-slate-300 rounded px-2 py-2"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              for {b.name}{b.is_default ? ' (Default)' : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
