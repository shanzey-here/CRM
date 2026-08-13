import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getInvoiceRenderData } from '@/modules/invoicing/server/render-data'
import { InvoiceRenderer } from '@/components/invoice/invoice-renderer'
import { Printer } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Mirrors /print/jobs/[id] exactly — the same, real, established convention
// this app already uses for "downloadable/printable document": print-aware
// Tailwind variants + the browser's own Print -> Save as PDF, not a second,
// server-side PDF-generation mechanism. Renders the exact same
// InvoiceRenderer the settings preview and the customer-facing invoice page
// use, so what prints matches what's shown on screen exactly — one
// implementation, three call sites.
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }

  const appMetadata = user.app_metadata || {}
  const role = (appMetadata.tenant_role ?? appMetadata.role) as string | undefined
  const tenantId = appMetadata.tenant_id

  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    redirect('/login?error=unauthorized_role')
  }

  const { success, data } = await getInvoiceRenderData(supabase, tenantId, id)
  if (!success || !data) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans print:p-0">
      <div className="mx-auto space-y-8 print:max-w-none" style={{ maxWidth: '794px' }}>
        {/* Print Toolbar (Hidden in actual print) */}
        <div className="flex justify-end print:hidden mb-8 border-b pb-4">
          <button
            id="print-btn"
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-emerald-600 text-white shadow hover:bg-emerald-700 h-9 px-4 py-2"
          >
            <Printer className="mr-2 h-4 w-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>

        <InvoiceRenderer blocks={data.blocks} invoice={data.invoice} brand={data.brand} contact={data.contact} />
      </div>

      <script dangerouslySetInnerHTML={{
        __html: `
          const printBtn = document.getElementById('print-btn');
          if (printBtn) {
            printBtn.addEventListener('click', () => window.print());
          }
        `
      }} />
    </div>
  )
}
