import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getContactByUserId } from '@/modules/clients/server/repository'
import { getInvoicesByContact } from '@/modules/invoicing/server/repository'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number) {
  return `£${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function CustomerInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  const tenantId = user.app_metadata?.tenant_id

  if (role !== 'customer') redirect('/')
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: contact, error: contactError } = await getContactByUserId(supabase, tenantId, user.id)
  if (contactError || !contact) {
    return <div className="p-8">No linked contact record found for this account.</div>
  }

  const { data: invoices, error: invoicesError } = await getInvoicesByContact(supabase, tenantId, contact.id)

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Your Invoices</h1>
      {invoicesError && <p className="text-red-600 text-sm mb-4">{invoicesError}</p>}
      {!invoices || invoices.length === 0 ? (
        <p className="text-slate-500 text-sm">No invoices yet.</p>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/customer/invoices/${inv.id}`}
              className="flex justify-between items-center p-4 bg-white border border-slate-200 rounded-lg hover:border-emerald-300 transition-colors"
            >
              <div>
                <p className="font-medium text-slate-900">{inv.invoice_number || inv.id.slice(0, 8)}</p>
                <p className="text-xs text-slate-500">{inv.status}</p>
              </div>
              <span className="font-semibold text-slate-900">{formatCurrency(inv.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
