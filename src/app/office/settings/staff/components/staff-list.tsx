'use client'

import { useState, useTransition } from 'react'
import { TenantUser } from '@/modules/users/server/repository'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import {
  updateStaffRoleAction,
  deactivateStaffAction,
  reactivateStaffAction,
} from '../actions'

interface Props {
  staff: TenantUser[]
}

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Admin',
  dispatcher: 'Dispatcher',
  crew: 'Crew',
}

export function StaffList({ staff }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleRoleChange = (userId: string, newRole: string) => {
    startTransition(async () => {
      try {
        setError(null)
        const formData = new FormData()
        formData.append('user_id', userId)
        formData.append('role', newRole)
        const result = await updateStaffRoleAction(formData)
        if ('error' in result) {
          setError(result.error)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update role')
      }
    })
  }

  const handleDeactivate = (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this staff member?')) return
    startTransition(async () => {
      try {
        setError(null)
        const formData = new FormData()
        formData.append('user_id', userId)
        const result = await deactivateStaffAction(formData)
        if ('error' in result) {
          setError(result.error)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to deactivate staff')
      }
    })
  }

  const handleReactivate = (userId: string) => {
    startTransition(async () => {
      try {
        setError(null)
        const formData = new FormData()
        formData.append('user_id', userId)
        const result = await reactivateStaffAction(formData)
        if ('error' in result) {
          setError(result.error)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reactivate staff')
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Role</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {staff.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-900">{member.full_name}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{member.email}</td>
                <td className="px-4 py-3 text-sm">
                  {expandedId === member.id ? (
                    <select
                      value={member.role}
                      onChange={(e) => {
                        handleRoleChange(member.id, e.target.value)
                        setExpandedId(null)
                      }}
                      disabled={isPending}
                      className="text-sm px-2 py-1 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="tenant_admin">Admin</option>
                      <option value="dispatcher">Dispatcher</option>
                      <option value="crew">Crew</option>
                    </select>
                  ) : (
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      {ROLE_LABELS[member.role] || member.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {member.is_active ? (
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={expandedId === member.id ? "Collapse staff actions" : "Expand staff actions"}
                    aria-label={expandedId === member.id ? "Collapse staff actions" : "Expand staff actions"}
                  >
                    <ChevronDown size={16} />
                  </button>
                  {expandedId === member.id && (
                    <div className="absolute mt-1 p-2 bg-white border border-slate-200 rounded shadow-lg z-10 right-4">
                      {member.is_active && (
                        <button
                          onClick={() => handleDeactivate(member.id)}
                          disabled={isPending}
                          className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      )}
                      {!member.is_active && (
                        <button
                          onClick={() => handleReactivate(member.id)}
                          disabled={isPending}
                          className="block w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {staff.length === 0 && (
        <div className="text-center py-8">
          <p className="text-slate-500">No active staff members yet. Start by inviting one!</p>
        </div>
      )}
    </div>
  )
}
