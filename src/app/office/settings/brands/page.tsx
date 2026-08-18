import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getBrands } from '@/modules/settings/brands/server/repository'
import { BrandForm } from './components/brand-form'
import { Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BrandsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: brands, error } = await getBrands(supabase, tenantId)

  if (error || !brands) {
    return <div>Failed to load brands: {error?.message || 'No data returned'}</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-slate-900">Brands</h1>
        <BrandForm />
      </div>
      <p className="text-sm text-slate-500 mb-8 max-w-2xl">
        If you run more than one public-facing business under this account — different name, logo, email,
        or invoicing identity — add each one here. Everything else (staff, scheduling, pricing, billing)
        stays shared; only the customer-facing identity on invoices, emails, and your web widget varies by brand.
      </p>

      <div className="space-y-3 max-w-2xl">
        {brands.map((brand) => (
          <div key={brand.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt="" className="h-10 w-10 object-contain rounded border border-slate-100" />
              ) : (
                <div className="h-10 w-10 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                  <Building2 className="h-5 w-5" />
                </div>
              )}
              <div>
                <p className="font-medium text-slate-900">
                  {brand.name}
                  {brand.is_default && (
                    <span className="ml-2 text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Default</span>
                  )}
                </p>
                <p className="text-xs text-slate-400">{brand.email || 'No email set'}</p>
              </div>
            </div>
            <BrandForm brand={brand} />
          </div>
        ))}
      </div>
    </div>
  )
}
