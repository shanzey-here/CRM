import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getInvoiceTemplateByBrand } from '@/modules/settings/invoice-template/server/repository'
import { getBrands, getDefaultBrandId } from '@/modules/settings/brands/server/repository'
import { TemplateEditor } from './components/template-editor'

export const dynamic = 'force-dynamic'

export default async function InvoiceTemplateSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>
}) {
  const { brand: brandParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: brands, error: brandsError } = await getBrands(supabase, tenantId)
  if (brandsError || !brands || brands.length === 0) {
    return <div>Failed to load brands: {brandsError?.message || 'No brands found for this tenant'}</div>
  }

  const activeBrandId = brandParam && brands.some((b) => b.id === brandParam)
    ? brandParam
    : (await getDefaultBrandId(supabase, tenantId)) || brands[0].id

  const activeBrand = brands.find((b) => b.id === activeBrandId)!

  const { data: template, error: templateError } = await getInvoiceTemplateByBrand(supabase, tenantId, activeBrandId)

  if (templateError || !template) {
    console.error('[InvoiceTemplate] Load error:', templateError)
    return <div>Failed to load invoice template: {templateError?.message || 'No data returned'}</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Invoice Template</h1>
      <p className="text-sm text-slate-500 mb-8">
        Arrange how your invoices are laid out. This only changes presentation — real figures are
        always pulled live from each invoice when it's viewed, never stored here.
      </p>
      <TemplateEditor template={template} brand={activeBrand} brands={brands} />
    </div>
  )
}
