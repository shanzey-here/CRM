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
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-full group/card transition-all duration-300 hover:shadow-md">
      <div className="border-b border-border bg-gradient-to-r from-muted/50 to-muted/10 px-6 py-5">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
            <Users className="h-4 w-4" />
          </div>
          Repeat Customers
        </h3>
        <p className="text-sm text-muted-foreground mt-2 pl-10">Customers with 2 or more completed jobs</p>
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : result?.success ? (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-foreground/80 table-fixed">
            <colgroup>
              <col className="w-2/3" />
              <col className="w-1/3" />
            </colgroup>
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-3.5 font-medium tracking-wider">Customer</th>
                <th className="px-6 py-3.5 font-medium text-right tracking-wider">Completed Jobs</th>
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
                  <tr key={customer.contact_id} className="group/row hover:bg-muted/30 transition-colors duration-200">
                    <td className="px-6 py-4 overflow-hidden">
                      <Link
                        href={`/office/contacts/${customer.contact_id}`}
                        className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate block transition-colors"
                        title={`${customer.first_name} ${customer.last_name || ''}`}
                      >
                        {customer.first_name} {customer.last_name || ''}
                      </Link>
                      {customer.email && (
                        <div className="text-xs text-muted-foreground mt-1 truncate" title={customer.email}>
                          {customer.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center justify-center bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2.5 py-1 rounded-full font-semibold text-sm ring-1 ring-inset ring-emerald-600/20 group-hover/row:scale-110 transition-transform duration-200">
                        {customer.completed_jobs_count}
                      </span>
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
