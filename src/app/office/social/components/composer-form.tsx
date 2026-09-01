'use client'

import { useState, useTransition, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { composePostSchema, ComposePostInput } from '@/modules/social/schemas'
import { composePostAction, ComposePostResult } from '../actions'
import { PlatformIcon, getPlatformColor } from './platform-icons'
import { LivePostPreview } from './live-post-preview'
import {
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  RotateCcw,
  Check,
} from 'lucide-react'

type Account = { id: string; platform: string; display_name: string }

interface ComposerFormProps {
  accounts: Account[]
  companyName?: string
  logoUrl?: string | null
}

const MAX_CHARS = 5000

export function ComposerForm({ accounts, companyName = 'Gomove Removals Ltd', logoUrl }: ComposerFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ComposePostResult | null>(null)
  const [liveText, setLiveText] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ComposePostInput>({
    resolver: zodResolver(composePostSchema),
    defaultValues: {
      content: '',
      accountIds: accounts.length > 0 ? [accounts[0].id] : [],
      scheduleMode: 'now',
      scheduledFor: '',
    },
  })

  // Register content field for validation
  useEffect(() => {
    register('content')
  }, [register])

  const selectedAccountIds = watch('accountIds') || []
  const scheduleMode = watch('scheduleMode')

  // Find unique platforms currently selected for preview
  const selectedPlatforms = Array.from(
    new Set(
      accounts
        .filter((a) => selectedAccountIds.includes(a.id))
        .map((a) => a.platform.toLowerCase())
    )
  )

  const toggleAccount = (id: string) => {
    if (selectedAccountIds.includes(id)) {
      setValue(
        'accountIds',
        selectedAccountIds.filter((accId) => accId !== id),
        { shouldValidate: true }
      )
    } else {
      setValue('accountIds', [...selectedAccountIds, id], { shouldValidate: true })
    }
  }

  const selectAllAccounts = () => {
    setValue(
      'accountIds',
      accounts.map((a) => a.id),
      { shouldValidate: true }
    )
  }

  const onSubmit = (data: ComposePostInput) => {
    setError(null)
    setLastResult(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('content', data.content)
      data.accountIds.forEach((id) => formData.append('accountIds', id))
      formData.append('scheduleMode', data.scheduleMode)
      if (data.scheduleMode === 'later' && data.scheduledFor) {
        formData.append('scheduledFor', new Date(data.scheduledFor).toISOString())
      }

      const result = await composePostAction(formData)
      setLastResult(result)
      if (!result.success) {
        setError(result.error)
      } else {
        setLiveText('')
        reset({
          content: '',
          accountIds: accounts.length > 0 ? [accounts[0].id] : [],
          scheduleMode: 'now',
          scheduledFor: '',
        })
      }
    })
  }

  const charCount = liveText.length
  const charsRemaining = MAX_CHARS - charCount
  const isNearLimit = charsRemaining < 200

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Rich Composer Form */}
        <div className="lg:col-span-7 space-y-4">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="p-5 sm:p-6 rounded-xl border border-slate-200 bg-white shadow-xs space-y-5"
          >
            {error && (
              <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{error}</span>
              </div>
            )}

            {/* Target Accounts Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Target Channels <span className="text-red-500">*</span>
                </label>
                {accounts.length > 1 && (
                  <button
                    type="button"
                    onClick={selectAllAccounts}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    Select all
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {accounts.map((account) => {
                  const isSelected = selectedAccountIds.includes(account.id)
                  const colors = getPlatformColor(account.platform)

                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => toggleAccount(account.id)}
                      title={`${isSelected ? 'Deselect' : 'Select'} ${account.display_name} (${account.platform})`}
                      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${account.display_name} (${account.platform})`}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-emerald-500/20 shadow-xs`
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center ${
                          isSelected ? colors.activeBg : 'bg-slate-200'
                        } ${isSelected ? colors.activeText : 'text-slate-600'}`}
                      >
                        <PlatformIcon platform={account.platform} className="w-3 h-3" />
                      </div>
                      <span className="font-semibold">{account.display_name}</span>
                      <span className="capitalize text-[11px] opacity-75">({account.platform})</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />}
                    </button>
                  )
                })}
              </div>

              {errors.accountIds && (
                <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.accountIds.message}
                </p>
              )}
            </div>

            {/* Post Content Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Post Content <span className="text-red-500">*</span>
                </label>
                <span
                  className={`text-[11px] font-mono font-medium ${
                    isNearLimit ? 'text-amber-600 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              </div>

              <div className="relative">
                <textarea
                  value={liveText}
                  onChange={(e) => {
                    setLiveText(e.target.value)
                    setValue('content', e.target.value, { shouldValidate: true })
                  }}
                  rows={6}
                  placeholder="Craft your social announcement, relocation tip, or customer update..."
                  className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all leading-relaxed resize-y"
                />
              </div>

              {errors.content && (
                <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.content.message}
                </p>
              )}
            </div>

            {/* When to Publish Segmented Switcher */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Publishing Schedule
              </label>

              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg max-w-sm">
                <button
                  type="button"
                  onClick={() => setValue('scheduleMode', 'now')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    scheduleMode === 'now'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Publish Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('scheduleMode', 'later')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    scheduleMode === 'later'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Schedule Later</span>
                </button>
              </div>

              {scheduleMode === 'later' && (
                <div className="mt-3 p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-blue-900">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Select Date & Time (in your local timezone)</span>
                  </div>
                  <input
                    type="datetime-local"
                    {...register('scheduledFor')}
                    className="w-full sm:w-auto px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono shadow-2xs"
                  />
                  {errors.scheduledFor && (
                    <p className="text-xs text-red-600 font-medium mt-1">{errors.scheduledFor.message}</p>
                  )}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setLiveText('')
                  reset({
                    content: '',
                    accountIds: accounts.length > 0 ? [accounts[0].id] : [],
                    scheduleMode: 'now',
                    scheduledFor: '',
                  })
                }}
                disabled={isPending || (!liveText && selectedAccountIds.length <= 1)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 active:bg-emerald-800 shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{scheduleMode === 'now' ? 'Publishing...' : 'Scheduling...'}</span>
                  </>
                ) : scheduleMode === 'now' ? (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Publish Immediately</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    <span>Schedule Post</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Submission Result Callout (for Immediate Post) */}
          {lastResult?.success && lastResult.mode === 'now' && (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Publishing Results</span>
              </div>
              <div className="space-y-1.5">
                {lastResult.results.map((r) => {
                  const account = accounts.find((a) => a.id === r.accountId)
                  return (
                    <div
                      key={r.accountId}
                      className="flex items-center justify-between gap-3 text-xs bg-white p-2.5 rounded-lg border border-emerald-100"
                    >
                      <div className="flex items-center gap-2">
                        {account && <PlatformIcon platform={account.platform} className="w-3.5 h-3.5" />}
                        <span className="font-medium text-slate-800">
                          {account?.display_name ?? r.accountId}
                        </span>
                      </div>
                      {r.ok ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            Published
                          </span>
                          {r.platformPostUrl && (
                            <a
                              href={r.platformPostUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-semibold"
                            >
                              <span>View live</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-700"
                          title={r.error}
                        >
                          Failed: {r.error}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Submission Result Callout (for Scheduled Post) */}
          {lastResult?.success && lastResult.mode === 'later' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-sm flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-semibold">Post scheduled successfully!</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Scheduled for {new Date(lastResult.scheduledFor).toLocaleString()}. The background sweep will publish it on time.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Live Feed Preview Mockup */}
        <div className="lg:col-span-5">
          <LivePostPreview
            content={liveText}
            platforms={selectedPlatforms}
            companyName={companyName}
            logoUrl={logoUrl}
          />
        </div>
      </div>
    </div>
  )
}
