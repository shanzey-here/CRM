'use client'

import { useState, useTransition } from 'react'
import { updateAiQuotingModeAction } from '../actions'
import { Loader2, Check } from 'lucide-react'

type Mode = 'off' | 'assist' | 'quote_review' | 'auto_send'

const MODES: { value: Mode; label: string; description: string }[] = [
  {
    value: 'off',
    label: 'Off',
    description: 'AI never drafts or sends replies for this inbox.',
  },
  {
    value: 'assist',
    label: 'Assist',
    description: 'Routine replies send automatically. Anything needing a quote is held for your review before it sends.',
  },
  {
    value: 'quote_review',
    label: 'Review everything',
    description: 'Every AI reply, routine or not, waits for your approval before it sends.',
  },
  {
    value: 'auto_send',
    label: 'Fully automatic',
    description:
      'AI sends replies and quotes without review. If a customer hasn’t provided enough detail for an accurate quote, it still asks a clarifying question automatically rather than sending a guess.',
  },
]

type GraduationStatus = { total: number; unedited: number; rate: number; qualifies: boolean }

export function ModeSelector({ currentMode, graduationStatus }: { currentMode: Mode; graduationStatus: GraduationStatus }) {
  const [selected, setSelected] = useState<Mode>(currentMode)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Already on auto_send: no re-gating (no ongoing/anomaly monitoring in
  // v1, by design) — only the moment of switching TO it is gated.
  const autoSendLocked = currentMode !== 'auto_send' && !graduationStatus.qualifies

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateAiQuotingModeAction(selected)
      if (!result.success) {
        setError(result.error || 'Failed to save')
        return
      }
      setSaved(true)
    })
  }

  return (
    <div className="space-y-3">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}

      <div className="space-y-2">
        {MODES.map((mode) => {
          const isLocked = mode.value === 'auto_send' && autoSendLocked
          return (
            <label
              key={mode.value}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                isLocked
                  ? 'cursor-not-allowed opacity-60 border-slate-200 bg-slate-50'
                  : `cursor-pointer ${selected === mode.value ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`
              }`}
            >
              <input
                type="radio"
                name="ai_quoting_mode"
                value={mode.value}
                checked={selected === mode.value}
                disabled={isLocked}
                onChange={() => {
                  setSelected(mode.value)
                  setSaved(false)
                }}
                className="mt-1"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{mode.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{mode.description}</p>
                {isLocked && (
                  <p className="text-xs text-amber-700 mt-1">
                    Available once you&apos;ve approved 20 AI drafts with minimal edits — you&apos;re at{' '}
                    {graduationStatus.total}/20
                    {graduationStatus.total > 0 ? `, ${Math.round(graduationStatus.rate * 100)}% unedited so far` : ''}.
                  </p>
                )}
              </div>
            </label>
          )
        })}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isPending || selected === currentMode}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save
        </button>
        {saved && <span className="text-xs text-emerald-700">Saved.</span>}
      </div>
    </div>
  )
}
