'use client'

import { useTransition } from 'react'
import { updateUiThemeAction } from '../actions'
import { Loader2, Check } from 'lucide-react'
import type { UiTheme } from '@/modules/settings/theme/schemas'

const THEMES: { value: UiTheme; label: string; description: string }[] = [
  { value: 'default', label: 'Default', description: 'Light background, blue accent — the standard look.' },
  { value: 'dark', label: 'Dark', description: 'Dark background, same accent colors, easier on the eyes in low light.' },
]

// Real preview swatches, not a name in a dropdown — each preview is scoped
// with the actual `dark` class (the same selector globals.css already
// defines: @custom-variant dark (&:is(.dark *))), so `bg-background`,
// `bg-card`, `bg-primary` etc. resolve to the real oklch values for that
// theme inside the swatch, not a hand-picked approximation.
function ThemePreview({ theme }: { theme: UiTheme }) {
  return (
    <div className={theme === 'dark' ? 'dark' : undefined}>
      <div className="rounded-md border border-border bg-background p-3 space-y-2">
        <div className="h-2 w-2/3 rounded-full bg-foreground/20" />
        <div className="rounded border border-border bg-card p-2 space-y-1.5">
          <div className="h-1.5 w-1/2 rounded-full bg-foreground/30" />
          <div className="h-1.5 w-3/4 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex gap-1.5">
          <span className="h-4 w-10 rounded bg-primary" />
          <span className="h-4 w-4 rounded bg-emerald-500" />
          <span className="h-4 w-4 rounded bg-amber-500" />
        </div>
      </div>
    </div>
  )
}

export function ThemePicker({ currentTheme }: { currentTheme: UiTheme }) {
  const [isPending, startTransition] = useTransition()

  function selectTheme(theme: UiTheme) {
    if (theme === currentTheme || isPending) return
    const formData = new FormData()
    formData.set('ui_theme', theme)
    startTransition(async () => {
      await updateUiThemeAction(formData)
    })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
      {THEMES.map((t) => {
        const isSelected = t.value === currentTheme
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => selectTheme(t.value)}
            disabled={isPending}
            className={`relative text-left rounded-lg border p-3 transition-colors disabled:opacity-60 ${
              isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/40'
            }`}
          >
            {isSelected && (
              <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </span>
            )}
            <ThemePreview theme={t.value} />
            <p className="mt-2 text-sm font-medium text-foreground">{t.label}</p>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </button>
        )
      })}
    </div>
  )
}
