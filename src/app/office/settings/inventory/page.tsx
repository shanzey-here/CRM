import { createClient } from '@/lib/supabase/server'
import { getInventoryItems } from '@/modules/inventory/server/repository'
import { InventoryList } from './components/inventory-list'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata?.tenant_id) {
    return <div>Unauthorized</div>
  }

  const tenantId = user.app_metadata.tenant_id
  const { data: items, error } = await getInventoryItems(supabase, tenantId)

  if (error) {
    return <div className="text-red-500">Failed to load inventory: {error.message}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold leading-7 text-gray-900">Inventory Catalog</h2>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          Manage the standard list of items and default volumes for quoting.
        </p>
      </div>

      {/* Client Component for rendering the table and forms */}
      <InventoryList items={items || []} />
    </div>
  )
}
