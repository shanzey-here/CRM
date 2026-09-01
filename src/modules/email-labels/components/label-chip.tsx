'use client'

import { X } from 'lucide-react'
import { getContrastTextColor, getReadableTextColor, hexToRgba } from '../color'

export type LabelChipProps = {
  name: string
  colorHex: string
  onRemove?: () => void
  size?: 'sm' | 'md'
  variant?: 'subtle' | 'solid' | 'outline'
  showDot?: boolean
  className?: string
}

export function LabelChip({
  name,
  colorHex,
  onRemove,
  size = 'sm',
  variant = 'subtle',
  showDot = true,
  className = '',
}: LabelChipProps) {
  const isSolid = variant === 'solid'
  const isOutline = variant === 'outline'
  
  const textColor = isSolid ? getContrastTextColor(colorHex) : getReadableTextColor(colorHex)
  const backgroundColor = isSolid
    ? colorHex
    : isOutline
    ? 'transparent'
    : hexToRgba(colorHex, 0.12)
  const borderColor = isSolid
    ? 'transparent'
    : hexToRgba(colorHex, isOutline ? 0.45 : 0.25)

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : 'px-2.5 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium transition-all select-none border ${sizeClasses} ${className}`}
      style={{
        backgroundColor,
        color: textColor,
        borderColor,
      }}
    >
      {showDot && !isSolid && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: colorHex }}
          aria-hidden="true"
        />
      )}
      <span className="truncate max-w-[150px]">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onRemove()
          }}
          className="shrink-0 ml-0.5 opacity-60 hover:opacity-100 transition-opacity focus:outline-none"
          title={`Remove ${name} label`}
          aria-label={`Remove ${name} label`}
        >
          <X size={size === 'sm' ? 11 : 13} />
        </button>
      )}
    </span>
  )
}
