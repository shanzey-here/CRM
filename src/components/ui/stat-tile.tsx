// Stat tile: label (sentence case) + value (semibold, proportional figures —
// never tabular-nums on a large standalone number) + optional caption.
// No reusable stat-tile existed anywhere in this app before this feature.
interface StatTileProps {
  label: string
  value: string
  caption?: string
  size?: 'default' | 'large'
  accentClassName?: string
}

export function StatTile({ label, value, caption, size = 'default', accentClassName }: StatTileProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1 font-semibold tracking-tight ${size === 'large' ? 'text-4xl' : 'text-2xl'} ${accentClassName ?? 'text-slate-900'}`}
        style={{ fontVariantNumeric: 'proportional-nums' }}
      >
        {value}
      </p>
      {caption && <p className="mt-1 text-xs text-slate-400">{caption}</p>}
    </div>
  )
}
