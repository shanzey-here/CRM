'use client'

import { useState } from 'react'
import { CancelButton } from './cancel-button'
import { PlatformIcon, getPlatformColor } from './platform-icons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Ban,
  ExternalLink,
  Calendar,
  Layers,
  Info,
} from 'lucide-react'
import { format } from 'date-fns'

type PublishResult = {
  accountId: string
  ok: boolean
  platformPostUrl?: string | null
  error?: string
}

export function getStatusBadgeConfig(status: string) {
  switch (status) {
    case 'published':
      return {
        label: 'Published',
        icon: CheckCircle2,
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500',
      }
    case 'pending':
      return {
        label: 'Scheduled',
        icon: Clock,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        dotClass: 'bg-blue-500',
      }
    case 'partial':
      return {
        label: 'Partial Delivery',
        icon: AlertTriangle,
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        dotClass: 'bg-amber-500',
      }
    case 'failed':
      return {
        label: 'Failed',
        icon: XCircle,
        badgeClass: 'bg-red-50 text-red-700 border-red-200',
        dotClass: 'bg-red-500',
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        icon: Ban,
        badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
        dotClass: 'bg-slate-400',
      }
    default:
      return {
        label: status,
        icon: Info,
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400',
      }
  }
}

export function SocialPostItem({
  post,
  accountsByIdMap,
}: {
  post: any
  accountsByIdMap: Record<string, any>
}) {
  const [isOpen, setIsOpen] = useState(false)

  const results = (post.publish_results as PublishResult[] | null) ?? null
  const isFuturePending = post.status === 'pending' && new Date(post.scheduled_for).getTime() > Date.now()
  const statusConfig = getStatusBadgeConfig(post.status)
  const StatusIcon = statusConfig.icon

  // Extract distinct platforms for this post
  const postAccounts = post.account_ids.map((id: string) => accountsByIdMap[id]).filter(Boolean)
  const platforms = Array.from(new Set(postAccounts.map((a: any) => a.platform.toLowerCase())))

  let formattedDate = ''
  try {
    formattedDate = format(new Date(post.scheduled_for), 'MMM d, yyyy · h:mm a')
  } catch {
    formattedDate = new Date(post.scheduled_for).toLocaleString()
  }

  // Find first successful live URL if exists
  const liveUrl = results?.find((r) => r.ok && r.platformPostUrl)?.platformPostUrl

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group space-y-3"
      >
        {/* Card Header: Platforms, Status, and Scheduled Time */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.badgeClass}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              <span>{statusConfig.label}</span>
            </span>

            {/* Platform Badges */}
            <div className="flex items-center gap-1">
              {platforms.length > 0 ? (
                platforms.map((plat: string) => {
                  const colors = getPlatformColor(plat)
                  return (
                    <span
                      key={plat}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      <PlatformIcon platform={plat} className="w-3 h-3" />
                      <span className="capitalize">{plat}</span>
                    </span>
                  )
                })
              ) : (
                <span className="text-xs text-slate-400">Multiple Channels</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formattedDate}</span>
          </div>
        </div>

        {/* Card Body: Post snippet */}
        <div className="text-sm text-slate-800 leading-relaxed line-clamp-3">
          {post.content}
        </div>

        {/* Card Footer: Accounts targeted & Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 truncate">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {postAccounts.length > 0
                ? postAccounts.map((a: any) => a.display_name).join(', ')
                : `${post.account_ids.length} target account(s)`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            {liveUrl && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
              >
                <span>View Live</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {isFuturePending && <CancelButton postId={post.id} />}

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 group-hover:text-emerald-700 transition-colors"
            >
              Details &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Detail Dialog Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[550px] p-6">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center justify-between">
              <span>Post Execution Details</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Meta row */}
            <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold border ${statusConfig.badgeClass}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  <span>{statusConfig.label}</span>
                </span>
              </div>
              <span className="text-slate-500 font-medium">
                Scheduled: {formattedDate}
              </span>
            </div>

            {/* Post Content */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Message Content
              </label>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                {post.content}
              </div>
            </div>

            {/* Publishing Results Breakdown */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Per-Channel Delivery Breakdown
              </label>
              {results && results.length > 0 ? (
                <div className="space-y-2">
                  {results.map((r) => {
                    const acc = accountsByIdMap[r.accountId]
                    return (
                      <div
                        key={r.accountId}
                        className="text-xs flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-center gap-2">
                          {acc && <PlatformIcon platform={acc.platform} className="w-4 h-4" />}
                          <span className="font-semibold text-slate-800">
                            {acc?.display_name ?? r.accountId.slice(0, 8)}
                          </span>
                          {acc && <span className="capitalize text-slate-400">({acc.platform})</span>}
                        </div>

                        {r.ok ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Delivered
                            </span>
                            {r.platformPostUrl && (
                              <a
                                href={r.platformPostUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:underline flex items-center gap-1 font-medium"
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 max-w-[220px] truncate"
                            title={r.error}
                          >
                            <XCircle className="w-3 h-3 shrink-0" />
                            {r.error || 'Failed'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-500">
                  {post.status === 'pending'
                    ? 'This post is queued. The scheduled background cron job will publish it automatically.'
                    : 'No delivery log recorded.'}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            {isFuturePending && (
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <CancelButton postId={post.id} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
