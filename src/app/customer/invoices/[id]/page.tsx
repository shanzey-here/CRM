import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getContactByUserId } from '@/modules/clients/server/repository'
import { getInvoiceRenderData } from '@/modules/invoicing/server/render-data'
import { InvoiceRenderer } from '@/components/invoice/invoice-renderer'

export const dynamic = 'force-dynamic'

export default async function CustomerInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  const tenantId = user.app_metadata?.tenant_id

  if (role !== 'customer') redirect('/')
  if (!tenantId) redirect('/login?error=no_tenant_context')

  // Resolve the caller's own contact_id first — RLS's customer_select policy
  // is the only thing enforcing "this invoice belongs to this customer"
  // today (no prior app-code precedent for this check exists anywhere in
  // the codebase, confirmed during planning), so this page adds its own
  // explicit ownership check on top, matching this project's fail-closed
  // convention rather than trusting RLS alone.
  const { data: contact, error: contactError } = await getContactByUserId(supabase, tenantId, user.id)
  if (contactError || !contact) {
    notFound()
  }

  const { success, data, error } = await getInvoiceRenderData(supabase, tenantId, id)
  if (!success || !data) {
    console.error('[CustomerInvoice] Load error:', error)
    notFound()
  }

  // Explicit contact-ownership check — belt-and-suspenders on top of RLS,
  // not an assumption that RLS alone is sufficient for this new surface.
  if (data.invoice.contact_id !== contact.id) {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <Link href="/customer/invoices" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>
      <div className="border border-slate-200 rounded-lg p-6 shadow-sm">
        <InvoiceRenderer blocks={data.blocks} invoice={data.invoice} tenantSettings={data.tenantSettings} contact={data.contact} />
      </div>
    </div>
  )
}
