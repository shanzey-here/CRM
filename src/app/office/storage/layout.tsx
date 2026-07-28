import { createClient } from '@/lib/supabase/server'
import { isStorageModuleEnabled } from '@/modules/storage/server/repository'
import { Package } from 'lucide-react'

// Same inline gate shape as src/app/office/workflows/page.tsx, consolidated
// into one shared layout instead of repeating it on every page under
// /office/storage.
export default async function StorageLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  if (!tenantId) {
    return <div>No tenant context found</div>
  }

  const isEnabled = await isStorageModuleEnabled(supabase, tenantId)

  if (!isEnabled) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Package className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-2 text-lg font-medium text-slate-900">Storage & Crate Tracking</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage physical storage units and track individual crates rented out to customers.
          </p>
          <div className="mt-6">
            <div className="inline-flex items-center rounded-md bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
              Not available on your current plan
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
