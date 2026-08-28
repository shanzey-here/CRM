'use client'

import { useState, useTransition } from 'react'
import { associateThreadAction, createContactFromThreadAction, searchContactsAndLeadsAction } from '../actions'
import { User, Search, Plus, Loader2, X, Link2, Check, ArrowRight } from 'lucide-react'

type Contact = { id: string; first_name: string; last_name: string | null; email: string | null }
type LeadResult = { id: string; stage: string; contacts: { first_name: string; last_name: string | null } | null }

export function AssociateThread({
  threadId,
  contact,
  lead,
}: {
  threadId: string
  contact?: { id: string; first_name: string; last_name: string | null } | null
  lead?: { id: string; stage: string; contacts?: { first_name: string; last_name: string | null } | null } | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'search' | 'create'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ contacts: Contact[]; leads: LeadResult[] }>({ contacts: [], leads: [] })
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSearch(q: string) {
    setQuery(q)
    startTransition(async () => {
      const result = await searchContactsAndLeadsAction(q)
      if ('error' in result) {
        setError(result.error)
      } else {
        setResults(result)
      }
    })
  }

  function handleLinkContact(contactId: string) {
    startTransition(async () => {
      const result = await associateThreadAction(threadId, { contactId })
      if ('error' in result) setError(result.error)
      else setIsOpen(false)
    })
  }

  function handleLinkLead(leadId: string) {
    startTransition(async () => {
      const result = await associateThreadAction(threadId, { leadId })
      if ('error' in result) setError(result.error)
      else setIsOpen(false)
    })
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createContactFromThreadAction(threadId, {
        firstName: formData.get('first_name') as string,
        lastName: formData.get('last_name') as string,
        email: formData.get('email') as string,
      })
      if ('error' in result) setError(result.error)
      else setIsOpen(false)
    })
  }

  const linkedName = lead?.contacts
    ? [lead.contacts.first_name, lead.contacts.last_name].filter(Boolean).join(' ')
    : contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    : null

  if (linkedName && !isOpen) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            lead
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          <span>{lead ? `Lead: ${linkedName}` : `Client: ${linkedName}`}</span>
        </span>
        <button
          onClick={() => setIsOpen(true)}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 hover:underline transition-colors"
        >
          Change
        </button>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-slate-300 bg-slate-50/50 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
      >
        <Link2 className="h-3.5 w-3.5 text-slate-400" />
        <span>Associate with Lead / Client</span>
      </button>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-lg space-y-3 w-full md:w-80 absolute md:right-8 z-30">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex gap-1.5">
          <button
            onClick={() => setMode('search')}
            className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
              mode === 'search' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Find Existing
          </button>
          <button
            onClick={() => setMode('create')}
            className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
              mode === 'create' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Plus className="h-3 w-3 inline mr-1" />
            New Contact
          </button>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
        >
          <X size={14} />
        </button>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
          {error}
        </div>
      )}

      {mode === 'search' ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {isPending && (
            <div className="py-2 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Searching...</span>
            </div>
          )}

          <div className="space-y-1 max-h-48 overflow-y-auto divide-y divide-slate-50">
            {results.contacts.length === 0 && results.leads.length === 0 && query && !isPending && (
              <p className="text-xs text-slate-400 text-center py-3">No matching leads or contacts found.</p>
            )}

            {results.contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => handleLinkContact(c.id)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 rounded-lg transition-colors group flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 group-hover:text-emerald-700">
                    {c.first_name} {c.last_name}
                  </div>
                  {c.email && <div className="text-[11px] text-slate-400 truncate">{c.email}</div>}
                </div>
                <Check className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100" />
              </button>
            ))}

            {results.leads.map((l) => (
              <button
                key={l.id}
                onClick={() => handleLinkLead(l.id)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 rounded-lg transition-colors group flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-900 group-hover:text-emerald-700">
                    Lead: {l.contacts?.first_name} {l.contacts?.last_name}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium capitalize">{l.stage} stage</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-600 opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form action={handleCreate} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <input
              name="first_name"
              placeholder="First name"
              required
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <input
              name="last_name"
              placeholder="Last name"
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <input
            name="email"
            type="email"
            placeholder="Email address"
            required
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-2xs"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Create & Link Contact'}
          </button>
        </form>
      )}
    </div>
  )
}
