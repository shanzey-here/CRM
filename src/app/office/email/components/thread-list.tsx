'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Mail,
  User,
  Search,
  CheckCircle2,
  Inbox,
  ArrowRight,
  Sparkles,
  Building2,
  X,
  Plus,
  AlertCircle,
} from 'lucide-react'
import { LabelChip } from '@/modules/email-labels/components/label-chip'

type Thread = {
  id: string
  subject: string | null
  participant_addresses: string[] | null
  last_message_at: string | null
  mailbox_id: string
  contact_id: string | null
  lead_id: string | null
  contacts: { id: string; first_name: string; last_name: string | null; email?: string } | null
  leads: { id: string; stage: string; contact_id: string | null; contacts: { first_name: string; last_name: string | null } | null } | null
  mailboxes?: { id: string; mailbox_address: string | null; brand_id: string | null; brands?: { name: string } | null } | null
}

type Mailbox = { id: string; mailbox_address: string | null; provider: string; is_active?: boolean; brand_id?: string | null; brands?: { name: string } | null }
type EmailLabel = { id: string; name: string; color_hex: string; is_default: boolean }

type SnippetInfo = {
  body: string
  from: string
  direction: string
  authored_by: string
}

function resolveContactName(thread: Thread): { name: string; type: 'contact' | 'lead'; id: string } | null {
  if (thread.leads?.contacts) {
    const name = [thread.leads.contacts.first_name, thread.leads.contacts.last_name].filter(Boolean).join(' ')
    return { name: name || 'Unnamed Lead', type: 'lead', id: thread.leads.id }
  }
  if (thread.contacts) {
    const name = [thread.contacts.first_name, thread.contacts.last_name].filter(Boolean).join(' ')
    return { name: name || 'Unnamed Contact', type: 'contact', id: thread.contacts.id }
  }
  return null
}

function getSenderDisplayName(thread: Thread, snippet?: SnippetInfo): { name: string; email: string; initials: string } {
  const contactName = resolveContactName(thread)
  const firstParticipant = (thread.participant_addresses ?? [])[0] || snippet?.from || 'Unknown'
  
  if (contactName) {
    const parts = contactName.name.split(' ')
    const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)
    return {
      name: contactName.name,
      email: firstParticipant,
      initials: initials.toUpperCase(),
    }
  }

  // Extract from email (e.g. "sarah.jenkins@example.com" -> "Sarah Jenkins")
  const emailPrefix = firstParticipant.split('@')[0] || 'UN'
  const cleanName = emailPrefix
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  const initials = emailPrefix.slice(0, 2).toUpperCase()

  return {
    name: cleanName,
    email: firstParticipant,
    initials,
  }
}

function formatThreadDate(isoString: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffHours < 48 && now.getDate() - date.getDate() === 1) {
    return 'Yesterday'
  }
  if (now.getFullYear() === date.getFullYear()) {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getAvatarBg(initials: string): string {
  const colors = [
    'bg-blue-100 text-blue-700 border-blue-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-purple-100 text-purple-700 border-purple-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-rose-100 text-rose-700 border-rose-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-teal-100 text-teal-700 border-teal-200',
  ]
  let hash = 0
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function ThreadList({
  threads,
  mailboxes,
  activeMailboxId,
  allLabels = [],
  threadLabels = {},
  threadSnippets = {},
  activeLabelIds = [],
  basePath = '/office/email',
}: {
  threads: Thread[]
  mailboxes: Mailbox[]
  activeMailboxId?: string
  allLabels?: EmailLabel[]
  threadLabels?: Record<string, { id: string; name: string; color_hex: string }[]>
  threadSnippets?: Record<string, SnippetInfo>
  activeLabelIds?: string[]
  // Which page the search / mailbox / label filter controls navigate to.
  // Defaults to the Inbox (unchanged); the Sent / Drafts / Important folder
  // tabs pass their own route so filtering stays on the current tab.
  basePath?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')

  function setMailboxFilter(mailboxId: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (mailboxId) params.set('mailbox', mailboxId)
    else params.delete('mailbox')
    router.push(`${basePath}?${params.toString()}`)
  }

  function toggleLabelFilter(labelId: string) {
    const params = new URLSearchParams(searchParams.toString())
    const next = activeLabelIds.includes(labelId)
      ? activeLabelIds.filter((id) => id !== labelId)
      : [...activeLabelIds, labelId]
    if (next.length > 0) params.set('labels', next.join(','))
    else params.delete('labels')
    router.push(`${basePath}?${params.toString()}`)
  }

  function clearAllFilters() {
    setSearchQuery('')
    router.push(basePath)
  }

  // Filter threads client-side by search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads
    const q = searchQuery.toLowerCase().trim()
    return threads.filter((t) => {
      const subjectMatch = (t.subject || '').toLowerCase().includes(q)
      const participantsMatch = (t.participant_addresses ?? []).some((p) => p.toLowerCase().includes(q))
      const snippetMatch = (threadSnippets[t.id]?.body || '').toLowerCase().includes(q)
      const contact = resolveContactName(t)
      const contactMatch = contact ? contact.name.toLowerCase().includes(q) : false
      return subjectMatch || participantsMatch || snippetMatch || contactMatch
    })
  }, [threads, searchQuery, threadSnippets])

  const hasActiveFilters = activeLabelIds.length > 0 || !!activeMailboxId || !!searchQuery.trim()

  // 1. If NO mailboxes are connected at all -> Render clean single onboarding state
  if (mailboxes.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center shadow-xs max-w-2xl mx-auto space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto text-amber-600 shadow-2xs">
          <Mail className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">No Mailbox Connected Yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Connect your company Gmail or IMAP inbox to automatically receive client move requests, generate instant AI quotes, and manage your communications.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/office/settings/mailboxes"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Connect Your Mailbox
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations, subjects, senders..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Mailbox selector pills if multiple */}
          {mailboxes.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setMailboxFilter(null)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap ${
                  !activeMailboxId
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Mailboxes
              </button>
              {mailboxes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMailboxFilter(m.id)}
                  title={`Filter by mailbox: ${m.brands?.name || m.mailbox_address}`}
                  aria-label={`Filter by mailbox: ${m.brands?.name || m.mailbox_address}`}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    activeMailboxId === m.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="h-3 w-3 opacity-60" />
                  <span>{m.brands?.name || m.mailbox_address}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Labels Filter Toolbar */}
        {allLabels.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-slate-400 mr-1 select-none">Filter by:</span>
              {allLabels.map((label) => {
                const isActive = activeLabelIds.includes(label.id)
                return (
                  <button
                    key={label.id}
                    onClick={() => toggleLabelFilter(label.id)}
                    className={`transition-all rounded-full ${
                      isActive
                        ? 'ring-2 ring-emerald-500/80 ring-offset-1 scale-105'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                    title={`Filter by label: ${label.name}`}
                    aria-label={`Filter by label: ${label.name}`}
                  >
                    <LabelChip
                      name={label.name}
                      colorHex={label.color_hex}
                      variant={isActive ? 'solid' : 'subtle'}
                      size="sm"
                    />
                  </button>
                )
              })}
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors ml-auto underline-offset-2 hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Threads List Container */}
      {filteredThreads.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">
            {hasActiveFilters ? 'No matching conversations' : 'No conversations found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your search query or clearing active label filters.'
              : 'New emails received in your connected mailbox will automatically appear here.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {filteredThreads.map((thread) => {
            const snippet = threadSnippets[thread.id]
            const sender = getSenderDisplayName(thread, snippet)
            const contactInfo = resolveContactName(thread)
            const labels = threadLabels[thread.id] ?? []
            const isOutboundLatest = snippet?.direction === 'outbound'
            const avatarColorClass = getAvatarBg(sender.initials)

            return (
              <Link
                key={thread.id}
                href={`/office/email/${thread.id}`}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 hover:bg-slate-50/80 transition-all"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {/* Sender Avatar Initials */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0 border mt-0.5 shadow-2xs ${avatarColorClass}`}
                  >
                    {sender.initials}
                  </div>

                  {/* Thread Content */}
                  <div className="min-w-0 flex-1">
                    {/* Top row: Sender Name & Mailbox context */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {sender.name}
                      </span>
                      {sender.email !== sender.name && (
                        <span className="text-xs text-slate-400 truncate max-w-[200px]">
                          &lt;{sender.email}&gt;
                        </span>
                      )}
                      {thread.mailboxes?.brands?.name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                          <Building2 className="h-2.5 w-2.5" />
                          {thread.mailboxes.brands.name}
                        </span>
                      )}
                    </div>

                    {/* Middle row: Subject and Body snippet */}
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className="text-xs sm:text-sm font-medium text-slate-800 truncate max-w-md">
                        {thread.subject || '(no subject)'}
                      </p>
                      {snippet?.body && (
                        <p className="text-xs text-slate-500 truncate hidden md:inline">
                          <span className="text-slate-400 mr-1">—</span>
                          {isOutboundLatest ? 'You: ' : ''}
                          {snippet.body}
                        </p>
                      )}
                    </div>

                    {/* Bottom row: Labels list */}
                    {labels.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {labels.map((label) => (
                          <LabelChip
                            key={label.id}
                            name={label.name}
                            colorHex={label.color_hex}
                            size="sm"
                            variant="subtle"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: CRM Link status & Date */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Lead / Contact Badge */}
                  {contactInfo ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        contactInfo.type === 'lead'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                          : 'bg-blue-50 text-blue-700 border-blue-200/70'
                      }`}
                    >
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-[120px]">{contactInfo.name}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200/60">
                      <User className="h-3 w-3 opacity-60" />
                      Unlinked
                    </span>
                  )}

                  {/* Timestamp */}
                  <span className="text-xs font-medium text-slate-400 whitespace-nowrap min-w-[65px] text-right">
                    {formatThreadDate(thread.last_message_at)}
                  </span>

                  {/* Chevron arrow icon */}
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all hidden sm:inline" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
