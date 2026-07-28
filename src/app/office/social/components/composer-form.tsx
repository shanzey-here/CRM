'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { composePostSchema, ComposePostInput } from '@/modules/social/schemas'
import { composePostAction, ComposePostResult } from '../actions'

type Account = { id: string; platform: string; display_name: string }

export function ComposerForm({ accounts }: { accounts: Account[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ComposePostResult | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ComposePostInput>({
    resolver: zodResolver(composePostSchema),
    defaultValues: { content: '', accountIds: [], scheduleMode: 'now', scheduledFor: '' },
  })

  const scheduleMode = watch('scheduleMode')

  const onSubmit = (data: ComposePostInput) => {
    setError(null)
    setLastResult(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('content', data.content)
      data.accountIds.forEach((id) => formData.append('accountIds', id))
      formData.append('scheduleMode', data.scheduleMode)
      // Convert the browser-local datetime-local value to an unambiguous
      // ISO/UTC string before it ever leaves the client — the server
      // process's local timezone may not match the dispatcher's.
      if (data.scheduleMode === 'later' && data.scheduledFor) {
        formData.append('scheduledFor', new Date(data.scheduledFor).toISOString())
      }

      const result = await composePostAction(formData)
      setLastResult(result)
      if (!result.success) {
        setError(result.error)
      } else {
        reset({ content: '', accountIds: [], scheduleMode: 'now', scheduledFor: '' })
      }
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 rounded-lg border border-slate-200 bg-white">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">Post content</label>
          <textarea
            {...register('content')}
            rows={4}
            placeholder="What do you want to post?"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          {errors.content && <p className="text-sm text-red-600 mt-1">{errors.content.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">Post to</label>
          <div className="space-y-1">
            {accounts.map((account) => (
              <label key={account.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" value={account.id} {...register('accountIds')} className="rounded border-slate-300" />
                {account.display_name} <span className="text-slate-400">({account.platform})</span>
              </label>
            ))}
          </div>
          {errors.accountIds && <p className="text-sm text-red-600 mt-1">{errors.accountIds.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">When</label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="radio" value="now" {...register('scheduleMode')} /> Post now
            </label>
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="radio" value="later" {...register('scheduleMode')} /> Schedule for later
            </label>
          </div>
          {scheduleMode === 'later' && (
            <div className="mt-2">
              <input
                type="datetime-local"
                {...register('scheduledFor')}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {errors.scheduledFor && <p className="text-sm text-red-600 mt-1">{errors.scheduledFor.message}</p>}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Sending...' : scheduleMode === 'now' ? 'Post now' : 'Schedule post'}
        </button>
      </form>

      {lastResult?.success && lastResult.mode === 'now' && (
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <p className="text-sm font-medium text-slate-900 mb-2">Result — per account</p>
          <div className="space-y-2">
            {lastResult.results.map((r) => {
              const account = accounts.find((a) => a.id === r.accountId)
              return (
                <div key={r.accountId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-700">{account?.display_name ?? r.accountId}</span>
                  {r.ok ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                      Posted{r.platformPostUrl ? (
                        <>
                          {' '}
                          &middot;{' '}
                          <a href={r.platformPostUrl} target="_blank" rel="noreferrer" className="underline">
                            view
                          </a>
                        </>
                      ) : null}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700" title={r.error}>
                      Failed — {r.error}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {lastResult?.success && lastResult.mode === 'later' && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-sm">
          Scheduled for {new Date(lastResult.scheduledFor).toLocaleString()}
        </div>
      )}
    </div>
  )
}
