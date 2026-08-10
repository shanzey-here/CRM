'use client'

import { X } from 'lucide-react'
import { getContrastTextColor } from '../color'

type LabelChipProps = {
  name: string
  colorHex: string
  onRemove?: () => void
  size?: 'sm' | 'md'
}

export function LabelChip({ name, colorHex, onRemove, size = 'sm' }: LabelChipProps) {
  const textColor = getContrastTextColor(colorHex)
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${padding}`}
      style={{ backgroundColor: colorHex, color: textColor }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label={`Remove ${name} label`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  )
}
