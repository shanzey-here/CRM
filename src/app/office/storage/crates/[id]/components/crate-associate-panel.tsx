'use client'

import { useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import { linkCrateAction, searchContactsAndJobsAction } from '../../../actions'

type Contact = { id: string; first_name: string; last_name: string; email?: string | null }
type Job = { id: string; status: string; move_date: string | null; contacts: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] }

export function CrateAssociatePanel({
  crateId,
  currentContact,
  currentJob,
}: {
  crateId: string
  currentContact: Contact | null
  currentJob: { id: string; status: string; move_date: string | null } | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ contacts: Contact[]; jobs: Job[] }>({ contacts: [], jobs: [] })
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSearch(value: string) {
    setQuery(value)
    startTransition(async () => {
      const found = await searchContactsAndJobsAction(value)
      setResults(found as any)
    })
  }

  function linkContact(contactId: string) {
    setError(null)
    startTransition(async () => {
      const result = await linkCrateAction(crateId, { contactId })
      if (!result.success) setError(result.error)
      else setIsOpen(false)
    })
  }

  function linkJob(jobId: string) {
    setError(null)
    startTransition(async () => {
      const result = await linkCrateAction(crateId, { jobId })
      if (!result.success) setError(result.error)
      else setIsOpen(false)
    })
  }

  function unlinkContact() {
    startTransition(async () => {
      await linkCrateAction(crateId, { contactId: null })
    })
  }

  function unlinkJob() {
    startTransition(async () => {
      await linkCrateAction(crateId, { jobId: null })
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 w-16">Contact:</span>
        {currentContact ? (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
            {currentContact.first_name} {currentContact.last_name}
            <button onClick={unlinkContact} disabled={isPending} className="text-blue-400 hover:text-blue-700">
              &times;
            </button>
          </span>
        ) : (
          <span className="text-xs text-slate-400">Unlinked</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 w-16">Job:</span>
        {currentJob ? (
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
            {currentJob.move_date ?? currentJob.id.slice(0, 8)} ({currentJob.status})
            <button onClick={unlinkJob} disabled={isPending} className="text-purple-400 hover:text-purple-700">
              &times;
            </button>
          </span>
        ) : (
          <span className="text-xs text-slate-400">Unlinked</span>
        )}
      </div>

      {!isOpen ? (
        <button onClick={() => setIsOpen(true)} className="text-xs text-emerald-600 hover:underline">
          + Link to a contact or job
        </button>
      ) : (
        <div className="border border-slate-200 rounded-lg p-3 bg-white">
          {error && <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search contacts or jobs by customer name..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div className="max-h-48 overflow-y-auto mt-2 space-y-1">
            {results.contacts.map((c) => (
              <button key={c.id} onClick={() => linkContact(c.id)} className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50 rounded flex items-center justify-between">
                <span>
                  {c.first_name} {c.last_name}
                </span>
                <span className="text-xs text-slate-400">Contact</span>
              </button>
            ))}
            {results.jobs.map((j) => {
              const contact = Array.isArray(j.contacts) ? j.contacts[0] : j.contacts
              return (
                <button key={j.id} onClick={() => linkJob(j.id)} className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50 rounded flex items-center justify-between">
                  <span>
                    {contact?.first_name} {contact?.last_name} — {j.move_date ?? 'no date'}
                  </span>
                  <span className="text-xs text-slate-400">Job</span>
                </button>
              )
            })}
            {query.trim().length >= 2 && results.contacts.length === 0 && results.jobs.length === 0 && (
              <p className="text-xs text-slate-400 px-2 py-1.5">No matches</p>
            )}
          </div>
          <button onClick={() => setIsOpen(false)} className="text-xs text-slate-500 hover:text-slate-800 mt-2">
            Close
          </button>
        </div>
      )}
    </div>
  )
}
