import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getInvoiceTemplateByBrand } from '@/modules/settings/invoice-template/server/repository'
import { getBrandById, getDefaultBrandId } from '@/modules/settings/brands/server/repository'
import { InvoiceRenderer } from '@/components/invoice/invoice-renderer'
import { SAMPLE_INVOICE_FOR_PREVIEW, SAMPLE_CONTACT_FOR_PREVIEW } from '@/components/invoice/sample-invoice-data'
import { InvoiceLayoutBlock } from '@/modules/settings/invoice-template/schemas'
import { Printer } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Deliberately a sibling of /print/invoices/[id], NOT nested under /office —
// a page under src/app/office/** inherits office/layout.tsx's sidebar AND
// settings/layout.tsx's sub-nav (confirmed the real, actual cause of a
// chrome-leaking PDF in the previous location), the same way every /office
// page correctly does for real app screens. This route intentionally only
// inherits the bare root layout (html/body, no chrome) — same as
// /print/invoices/[id], via directory placement, not print CSS.
export default async function InvoiceTemplateFullPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>
}) {
  const { brand: brandParam } = await searchParams
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

  const brandId = brandParam || (await getDefaultBrandId(supabase, tenantId))
  if (!brandId) notFound()

  const [{ data: brand }, { data: template }] = await Promise.all([
    getBrandById(supabase, tenantId, brandId),
    getInvoiceTemplateByBrand(supabase, tenantId, brandId),
  ])

  if (!brand || !template) notFound()

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans print:p-0">
      <div className="mx-auto space-y-4 print:max-w-none" style={{ maxWidth: '794px' }}>
        <div className="flex justify-between items-center mb-4 border-b pb-4">
          {/* Deliberately NOT print:hidden — stays visible in the printed/
              downloaded output too, so a saved PDF of this preview is never
              mistaken for a real invoice. */}
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 print:border-2 print:border-amber-500">
            Sample placeholder data for <strong>{brand.name}</strong> — not a real invoice. Shows the last saved template.
          </div>
          <button
            id="print-btn"
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-emerald-600 text-white shadow hover:bg-emerald-700 h-9 px-4 shrink-0 ml-4 print:hidden"
          >
            <Printer className="mr-2 h-4 w-4" />
            <span>Print / Save as PDF</span>
          </button>
        </div>

        <InvoiceRenderer
          blocks={(template.layout_blocks as unknown as InvoiceLayoutBlock[]) || []}
          invoice={SAMPLE_INVOICE_FOR_PREVIEW}
          brand={brand}
          contact={SAMPLE_CONTACT_FOR_PREVIEW}
        />
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
