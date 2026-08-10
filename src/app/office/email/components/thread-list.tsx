'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, User } from 'lucide-react'
import { LabelChip } from '@/modules/email-labels/components/label-chip'

type Thread = {
  id: string
  subject: string | null
  participant_addresses: string[] | null
  last_message_at: string | null
  mailbox_id: string
  contact_id: string | null
  lead_id: string | null
  contacts: { first_name: string; last_name: string | null } | null
  leads: { contacts: { first_name: string; last_name: string | null } | null } | null
}

type Mailbox = { id: string; mailbox_address: string | null; provider: string }
type EmailLabel = { id: string; name: string; color_hex: string; is_default: boolean }

function resolveContactName(thread: Thread): string | null {
  if (thread.contacts) {
    return [thread.contacts.first_name, thread.contacts.last_name].filter(Boolean).join(' ')
  }
  if (thread.leads?.contacts) {
    return [thread.leads.contacts.first_name, thread.leads.contacts.last_name].filter(Boolean).join(' ')
  }
  return null
}

export function ThreadList({
  threads,
  mailboxes,
  activeMailboxId,
  allLabels = [],
  threadLabels = {},
  activeLabelIds = [],
}: {
  threads: Thread[]
  mailboxes: Mailbox[]
  activeMailboxId?: string
  allLabels?: EmailLabel[]
  threadLabels?: Record<string, { id: string; name: string; color_hex: string }[]>
  activeLabelIds?: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setMailboxFilter(mailboxId: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (mailboxId) params.set('mailbox', mailboxId)
    else params.delete('mailbox')
    router.push(`/office/email?${params.toString()}`)
  }

  // OR semantics — toggling a label pill adds/removes it from the
  // comma-separated `labels` param; any thread carrying ANY selected label matches.
  function toggleLabelFilter(labelId: string) {
    const params = new URLSearchParams(searchParams.toString())
    const next = activeLabelIds.includes(labelId)
      ? activeLabelIds.filter((id) => id !== labelId)
      : [...activeLabelIds, labelId]
    if (next.length > 0) params.set('labels', next.join(','))
    else params.delete('labels')
    router.push(`/office/email?${params.toString()}`)
  }

  return (
    <div>
      {allLabels.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {allLabels.map((label) => {
            const isActive = activeLabelIds.includes(label.id)
            return (
              <button key={label.id} onClick={() => toggleLabelFilter(label.id)} className={isActive ? 'ring-2 ring-offset-1 ring-slate-400 rounded-full' : ''}>
                <LabelChip name={label.name} colorHex={label.color_hex} />
              </button>
            )
          })}
        </div>
      )}

      {mailboxes.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setMailboxFilter(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              !activeMailboxId ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            All mailboxes
          </button>
          {mailboxes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMailboxFilter(m.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                activeMailboxId === m.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {m.mailbox_address}
            </button>
          ))}
        </div>
      )}

      {threads.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500">
          <Mail className="h-8 w-8 mx-auto text-slate-300 mb-2" />
          No email threads yet.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {threads.map((thread) => {
            const contactName = resolveContactName(thread)
            return (
              <Link
                key={thread.id}
                href={`/office/email/${thread.id}`}
                className="block p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{thread.subject || '(no subject)'}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {(thread.participant_addresses ?? []).join(', ') || 'No participants recorded'}
                    </p>
                    {(threadLabels[thread.id] ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {threadLabels[thread.id].map((label) => (
                          <LabelChip key={label.id} name={label.name} colorHex={label.color_hex} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        contactName ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <User className="h-3 w-3" />
                      {contactName || 'Unlinked'}
                    </span>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {thread.last_message_at ? new Date(thread.last_message_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
