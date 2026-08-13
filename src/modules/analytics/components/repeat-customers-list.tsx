'use client'

import { useState, useEffect } from 'react'
import { getRepeatCustomersAction, RepeatCustomerWithDetails } from '@/app/office/reports/actions'
import { Loader2, Users } from 'lucide-react'
import Link from 'next/link'

export function RepeatCustomersList() {
  const [isLoading, setIsLoading] = useState(true)
  const [result, setResult] = useState<{ success: true; data: RepeatCustomerWithDetails[] } | { success: false; error: string; code?: string } | null>(null)

  useEffect(() => {
    let mounted = true
    getRepeatCustomersAction().then(res => {
      if (mounted) {
        setResult(res)
        setIsLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  if (result && !result.success && result.code === 'PT403') {
    return null // The Funnel component will show the entitlement banner for the whole page.
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border bg-muted/50 px-6 py-4">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          Repeat Customers
        </h3>
        <p className="text-sm text-muted-foreground mt-1">Customers with 2 or more completed jobs</p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : result?.success ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-foreground/80">
            <thead className="bg-muted text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium text-right">Completed Jobs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.data.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-8 text-center text-muted-foreground italic">
                    No repeat customers found yet.
                  </td>
                </tr>
              ) : (
                result.data.map(customer => (
                  <tr key={customer.contact_id} className="hover:bg-muted/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/office/contacts/${customer.contact_id}`}
                        className="font-medium text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {customer.first_name} {customer.last_name || ''}
                      </Link>
                      {customer.email && (
                        <div className="text-xs text-muted-foreground mt-0.5">{customer.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-foreground">
                      {customer.completed_jobs_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-sm text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950">
          {result?.error || 'Failed to load repeat customers'}
        </div>
      )}
    </div>
  )
}
