'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Inbox, Sparkles, Send, Settings, Tag, ShieldCheck } from 'lucide-react'

type EmailNavigationProps = {
  pendingReviewCount?: number
  mailboxCount?: number
}

export function EmailNavigation({ pendingReviewCount = 0, mailboxCount }: EmailNavigationProps) {
  const pathname = usePathname()

  const tabs = [
    {
      href: '/office/email',
      label: 'Inbox',
      icon: Inbox,
      isActive: pathname === '/office/email',
    },
    {
      href: '/office/email/review-queue',
      label: 'Review Queue',
      icon: Sparkles,
      isActive: pathname.startsWith('/office/email/review-queue'),
      count: pendingReviewCount,
      countVariant: 'amber' as const,
    },
    {
      href: '/office/email/auto-sent-log',
      label: 'Auto-Sent Log',
      icon: Send,
      isActive: pathname.startsWith('/office/email/auto-sent-log'),
    },
  ]

  return (
    <div className="border-b border-slate-200 bg-white -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8 px-4 sm:px-6 lg:px-8 pt-6 pb-0 mb-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Email &amp; AI Communications
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Centralized inbox for client inquiries, AI drafting, and automated move quoting.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Link
            href="/office/settings/ai-assistant"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>AI Trust Level</span>
          </Link>
          <Link
            href="/office/settings/email-labels"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors"
          >
            <Tag className="h-3.5 w-3.5 text-blue-600" />
            <span>Labels</span>
          </Link>
          <Link
            href="/office/settings/mailboxes"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span>Mailboxes {mailboxCount !== undefined ? `(${mailboxCount})` : ''}</span>
          </Link>
        </div>
      </div>

      {/* Modern Tabs */}
      <nav className="flex items-center gap-1 -mb-px overflow-x-auto no-scrollbar" aria-label="Email Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                tab.isActive
                  ? 'border-emerald-600 text-emerald-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`h-4 w-4 ${tab.isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    tab.countVariant === 'amber'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
