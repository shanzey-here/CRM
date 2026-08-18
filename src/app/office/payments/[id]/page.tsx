import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function PaymentDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) redirect('/login')

  const tenantId = user.app_metadata.tenant_id

  const { data: payment, error } = await supabase
    .from('payments')
    .select(`
      *,
      invoice:invoices (
        id,
        total,
        status,
        due_date,
        job_id
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('id', params.id)
    .single()

  if (error || !payment) notFound()

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="mb-4">
        <Link href={`/office/invoices/${payment.invoice_id}`} className="text-sm text-blue-600 hover:underline">
          &larr; Back to Invoice
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Receipt</h1>
            <p className="text-slate-500 mt-1">ID: {payment.id}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-600">£{Number(payment.amount).toFixed(2)}</p>
            <Badge variant="outline" className="mt-2 uppercase bg-emerald-50 text-emerald-700 border-emerald-200">
              Completed
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Payment Date</h3>
            <p className="text-base font-medium text-slate-900">
              {format(new Date(payment.payment_date || payment.created_at), 'PPP')}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-1">Payment Method</h3>
            <p className="text-base font-medium text-slate-900 uppercase">
              {payment.payment_method || 'N/A'}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Related Invoice</h2>
          {payment.invoice ? (
            <div className="flex justify-between items-center">
              <div>
                <Link href={`/office/invoices/${payment.invoice_id}`} className="font-medium text-emerald-600 hover:underline">
                  Invoice #{payment.invoice.id.split('-')[0]}
                </Link>
                <p className="text-xs text-slate-500 mt-1">
                  Total: £{Number(payment.invoice.total).toFixed(2)} • Status: {payment.invoice.status}
                </p>
              </div>
              {payment.invoice.job_id && (
                <Link href={`/office/jobs/${payment.invoice.job_id}`} className="text-sm text-blue-600 hover:underline font-medium">
                  View Job &rarr;
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Invoice details unavailable.</p>
          )}
        </div>
      </div>
    </div>
  )
}
