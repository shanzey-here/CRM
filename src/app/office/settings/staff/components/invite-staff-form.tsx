'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { inviteStaffSchema, InviteStaffInput } from '@/modules/settings/staff/schemas'
import { inviteStaffAction } from '../actions'
import { Copy, Check } from 'lucide-react'

export function InviteStaffForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteStaffInput>({
    resolver: zodResolver(inviteStaffSchema),
  })

  const onSubmit = (data: InviteStaffInput) => {
    startTransition(async () => {
      try {
        setError(null)
        setTempPassword(null)

        const formData = new FormData()
        formData.append('email', data.email)
        formData.append('full_name', data.full_name)
        formData.append('role', data.role)

        const result = await inviteStaffAction(formData)

        if ('error' in result) {
          setError(result.error)
        } else {
          setTempPassword(result.tempPassword || null)
          reset()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to invite staff')
      }
    })
  }

  const handleCopyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 sticky top-4">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Invite Staff Member</h3>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4">
          {error}
        </div>
      )}

      {tempPassword ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded mb-4">
          <p className="text-sm text-emerald-900 font-semibold mb-3">
            Staff member invited successfully!
          </p>
          <p className="text-xs text-emerald-800 mb-2">
            Share this temporary password with the new staff member:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2 py-1 bg-white border border-emerald-200 rounded text-sm font-mono">
              {tempPassword}
            </code>
            <button
              onClick={handleCopyPassword}
              className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs text-emerald-800 mt-2">
            They can log in with their email address and this password.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Full Name</label>
            <input
              type="text"
              {...register('full_name')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="John Smith"
            />
            {errors.full_name && (
              <p className="text-xs text-red-600 mt-1">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Role</label>
            <select
              {...register('role')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
            >
              <option value="">Select a role...</option>
              <option value="tenant_admin">Admin</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="crew">Crew</option>
            </select>
            {errors.role && (
              <p className="text-xs text-red-600 mt-1">{errors.role.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Inviting...' : 'Invite Staff Member'}
          </button>
        </form>
      )}
    </div>
  )
}
