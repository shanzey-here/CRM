'use client'

import { useState, useTransition } from 'react'
import { disconnectMailboxAction } from '../actions'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

type Mailbox = {
  id: string
  provider: string
  connection_method: string
  mailbox_address: string | null
  is_active: boolean | null
  last_synced_at: string | null
  last_sync_error: string | null
  created_at: string | null
}

export function MailboxList({ mailboxes }: { mailboxes: Mailbox[] }) {
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  if (mailboxes.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
        No mailboxes connected yet.
      </div>
    )
  }

  function handleDisconnect(id: string) {
    setPendingId(id)
    startTransition(async () => {
      await disconnectMailboxAction(id)
      setPendingId(null)
    })
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
      {mailboxes.map((mailbox) => {
        const isBroken = !mailbox.is_active
        return (
          <div key={mailbox.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              {isBroken ? (
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-900">{mailbox.mailbox_address}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {mailbox.provider} · {mailbox.connection_method === 'oauth' ? 'OAuth' : 'IMAP password'}
                  {mailbox.last_synced_at && !isBroken && (
                    <> · last synced {new Date(mailbox.last_synced_at).toLocaleString('en-GB')}</>
                  )}
                </p>
                {isBroken && mailbox.last_sync_error && (
                  <p className="text-xs text-red-600 mt-1">{mailbox.last_sync_error}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isBroken && (
                mailbox.connection_method === 'oauth' ? (
                  <a
                    href="/api/oauth/gmail/start"
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                  >
                    Reconnect
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">Reconnect via the IMAP form below</span>
                )
              )}
              {!isBroken && (
                <button
                  onClick={() => handleDisconnect(mailbox.id)}
                  disabled={isPending && pendingId === mailbox.id}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {isPending && pendingId === mailbox.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Disconnect'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
