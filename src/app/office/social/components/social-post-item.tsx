'use client'

import { useState } from 'react'
import { CancelButton } from './cancel-button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  published: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400',
}

type PublishResult = { accountId: string; ok: boolean; platformPostUrl?: string | null; error?: string }

export function SocialPostItem({ post, accountsByIdMap }: { post: any, accountsByIdMap: Record<string, any> }) {
  const [isOpen, setIsOpen] = useState(false)

  const results = (post.publish_results as PublishResult[] | null) ?? null
  const isFuturePending = post.status === 'pending' && new Date(post.scheduled_for).getTime() > Date.now()
  const accountNames = post.account_ids.map((id: string) => accountsByIdMap[id]?.display_name ?? id.slice(0, 8)).join(', ')

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        className="p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer relative group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[post.status] ?? 'bg-slate-100 text-slate-700'}`}>
                {post.status}
              </span>
              <span className="text-xs text-slate-500">{accountNames}</span>
            </div>
            <p className="text-sm text-slate-800 mt-2 line-clamp-3">{post.content}</p>
            <p className="text-xs text-slate-400 mt-2">Scheduled for {new Date(post.scheduled_for).toLocaleString()}</p>
          </div>

          {isFuturePending && (
            <div className="shrink-0 relative z-10" onClick={(e) => e.stopPropagation()}>
              <CancelButton postId={post.id} />
            </div>
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`capitalize ${STATUS_BADGE[post.status] ?? ''}`}>
                {post.status}
              </Badge>
              <span className="text-sm text-slate-500">
                Scheduled for {new Date(post.scheduled_for).toLocaleString()}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-md border border-slate-100">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{post.content}</p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Publishing Status</h4>
              {results ? (
                <div className="space-y-2">
                  {results.map((r) => (
                    <div key={r.accountId} className="text-sm flex justify-between p-2 rounded bg-slate-50 border border-slate-100">
                      <span className="font-medium text-slate-700">
                        {accountsByIdMap[r.accountId]?.display_name ?? r.accountId.slice(0, 8)}
                      </span>
                      {r.ok ? (
                        r.platformPostUrl ? (
                          <a href={r.platformPostUrl} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline font-medium">
                            View Post
                          </a>
                        ) : (
                          <span className="text-emerald-600 font-medium">Posted</span>
                        )
                      ) : (
                        <span className="text-red-600 max-w-[200px] text-right truncate" title={r.error}>{r.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No results yet. Post has not been processed.</p>
              )}
            </div>

            {isFuturePending && (
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <CancelButton postId={post.id} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
