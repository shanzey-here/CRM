'use client'

import { useState, useTransition } from 'react'
import { connectImapMailboxAction } from '../actions'
import { Loader2 } from 'lucide-react'

export function ConnectImapForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await connectImapMailboxAction(formData)
      if ('error' in result) {
        setError(result.error)
      } else {
        setSuccess(true)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-xs">
          Mailbox connected.
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <input
          name="mailbox_address"
          type="email"
          placeholder="you@example.com"
          required
          className="col-span-2 px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <input
          name="host"
          type="text"
          placeholder="imap.example.com"
          required
          className="px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <input
          name="port"
          type="number"
          placeholder="993"
          defaultValue={993}
          required
          className="px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <input
          name="password"
          type="password"
          placeholder="Password or app password"
          required
          className="col-span-2 px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Connect via IMAP
      </button>
    </form>
  )
}
