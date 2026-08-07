import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getInvoiceById } from '@/modules/invoicing/server/repository'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EditDraftInvoiceForm } from './components/edit-draft-invoice-form'

export const dynamic = 'force-dynamic'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) redirect('/login')

  const tenantId = user.app_metadata.tenant_id
  const { success, data: invoice, error } = await getInvoiceById(supabase, tenantId, id)

  if (!success || !invoice) notFound()

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Invoice #{invoice.id.split('-')[0]}</h1>
            <Badge variant={invoice.status === 'paid' ? 'default' : 'outline'} className="uppercase">
              {invoice.status}
            </Badge>
          </div>
          <p className="text-slate-500 mt-1">
            Created: {format(new Date(invoice.created_at), 'MMM d, yyyy')}
            {invoice.due_date && ` • Due: ${format(new Date(invoice.due_date), 'MMM d, yyyy')}`}
          </p>
          {invoice.status === 'draft' && invoice.payments.length > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              This draft invoice already has a payment recorded against it and can no longer be edited.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {invoice.status === 'draft' && invoice.payments.length === 0 && (
            <EditDraftInvoiceForm
              invoiceId={invoice.id}
              notes={invoice.notes}
              lineItems={invoice.lineItems.map((li) => ({
                description: li.description,
                quantity: Number(li.quantity),
                unit_price: Number(li.unit_price),
                sort_order: li.sort_order,
              }))}
            />
          )}
          <Button variant="outline" asChild>
            <Link href={`/customer/invoices/${invoice.id}`} target="_blank">
              View Customer Portal
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Line Items</h2>
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="pb-3 text-left">Description</th>
                  <th className="pb-3 text-right">Qty</th>
                  <th className="pb-3 text-right">Unit Price</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lineItems.map(item => (
                  <tr key={item.id}>
                    <td className="py-3 text-slate-900">{item.description}</td>
                    <td className="py-3 text-right text-slate-500">{item.quantity}</td>
                    <td className="py-3 text-right text-slate-500">£{Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-3 text-right font-medium text-slate-900">£{Number(item.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="py-3 text-right font-medium text-slate-900">Total</td>
                  <td className="py-3 text-right font-bold text-slate-900">£{Number(invoice.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          {invoice.job_id && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Related Job</h2>
              <Link href={`/office/jobs/${invoice.job_id}`} className="text-emerald-600 hover:underline text-sm font-medium">
                View Job Details &rarr;
              </Link>
            </div>
          )}

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Payment History</h2>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments recorded.</p>
            ) : (
              <div className="space-y-3">
                {invoice.payments.map(payment => (
                  <div key={payment.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-slate-900">{format(new Date(payment.payment_date || payment.created_at), 'MMM d, yyyy')}</p>
                      <p className="text-xs text-slate-500 uppercase">{payment.payment_method}</p>
                    </div>
                    <p className="font-semibold text-emerald-600">£{Number(payment.amount).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
