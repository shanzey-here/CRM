'use client'

import { useState, useTransition } from 'react'
import { associateThreadAction, createContactFromThreadAction, searchContactsAndLeadsAction } from '../actions'
import { User, Search, Plus, Loader2, X } from 'lucide-react'

type Contact = { id: string; first_name: string; last_name: string | null; email: string | null }
type LeadResult = { id: string; stage: string; contacts: { first_name: string; last_name: string | null } | null }

export function AssociateThread({ threadId, contact }: { threadId: string; contact: { id: string; first_name: string; last_name: string | null } | null }) {
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

  if (contact && !isOpen) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
          <User className="h-3 w-3" /> {[contact.first_name, contact.last_name].filter(Boolean).join(' ')}
        </span>
        <button onClick={() => setIsOpen(true)} className="text-xs text-slate-500 hover:text-slate-700 underline">
          Change
        </button>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
      >
        <User className="h-3 w-3" /> Unlinked — click to associate
      </button>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setMode('search')}
            className={`text-xs px-2 py-1 rounded ${mode === 'search' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
          >
            Find existing
          </button>
          <button
            onClick={() => setMode('create')}
            className={`text-xs px-2 py-1 rounded ${mode === 'create' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
          >
            <Plus className="h-3 w-3 inline" /> New contact
          </button>
        </div>
        <button onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}

      {mode === 'search' ? (
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search contacts or leads by name/email..."
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {results.contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => handleLinkContact(c.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded"
              >
                {c.first_name} {c.last_name} <span className="text-xs text-slate-400">{c.email}</span>
              </button>
            ))}
            {results.leads.map((l) => (
              <button
                key={l.id}
                onClick={() => handleLinkLead(l.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded"
              >
                Lead: {l.contacts?.first_name} {l.contacts?.last_name} <span className="text-xs text-slate-400">({l.stage})</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <form action={handleCreate} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input name="first_name" placeholder="First name" required className="px-3 py-2 border border-slate-300 rounded text-sm" />
            <input name="last_name" placeholder="Last name" className="px-3 py-2 border border-slate-300 rounded text-sm" />
          </div>
          <input name="email" type="email" placeholder="Email" required className="w-full px-3 py-2 border border-slate-300 rounded text-sm" />
          <button
            type="submit"
            disabled={isPending}
            className="w-full px-3 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Create & Link'}
          </button>
        </form>
      )}
    </div>
  )
}
