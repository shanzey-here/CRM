import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/types/database.types'
import { 
  getInventoryItems, 
  createInventoryItem, 
  updateInventoryItem, 
  deleteInventoryItem 
} from '../src/modules/inventory/server/repository'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  console.log('--- RUNNING INVENTORY REPO TESTS ---')

  const TENANT_A = '11111111-1111-1111-1111-111111111111'
  const TENANT_B = '22222222-2222-2222-2222-222222222222'

  // Ensure tenants exist (mocked in tests usually, relying on phase0 foundations)
  const { error: tenantErr } = await supabase.from('tenants').upsert([
    { id: TENANT_A, name: 'Tenant A', slug: 'tenant-a' },
    { id: TENANT_B, name: 'Tenant B', slug: 'tenant-b' }
  ]).select()
  
  if (tenantErr) {
    console.warn('Tenant upsert failed (might already exist):', tenantErr.message)
  }

  // 1. Create an item for Tenant A
  const { data: itemA, error: errA } = await createInventoryItem(supabase, TENANT_A, {
    name: 'Sofa',
    room: 'living_room',
    default_volume: 50,
    is_active: true
  })
  if (errA || !itemA) throw new Error(`Failed to create item A: ${errA?.message}`)
  console.log('✅ createInventoryItem works')

  // 2. Fetch items for Tenant A
  const { data: itemsA, error: fetchErrA } = await getInventoryItems(supabase, TENANT_A)
  if (fetchErrA) throw fetchErrA
  if (!itemsA?.some(i => i.id === itemA.id)) throw new Error('Tenant A cannot see its own item')
  console.log('✅ getInventoryItems retrieves correct tenant data')

  // 3. Fetch items for Tenant B
  const { data: itemsB } = await getInventoryItems(supabase, TENANT_B)
  if (itemsB?.some(i => i.id === itemA.id)) throw new Error('Tenant B can see Tenant A item - isolation breach!')
  console.log('✅ getInventoryItems strictly isolates by tenant_id')

  // 4. Update item for Tenant A
  const { data: updatedA, error: updateErrA } = await updateInventoryItem(supabase, TENANT_A, itemA.id, {
    default_volume: 60
  })
  if (updateErrA || !updatedA || updatedA.default_volume !== 60) throw new Error('Failed to update item A')
  console.log('✅ updateInventoryItem works')

  // 5. Update item from Tenant B context (should fail/return nothing)
  const { data: maliciousUpdate } = await updateInventoryItem(supabase, TENANT_B, itemA.id, {
    name: 'Hacked'
  })
  if (maliciousUpdate) throw new Error('Tenant B successfully updated Tenant A item - isolation breach!')
  console.log('✅ updateInventoryItem strictly isolates by tenant_id')

  // 6. Soft Delete item for Tenant A
  const { data: deletedA, error: delErrA } = await deleteInventoryItem(supabase, TENANT_A, itemA.id)
  if (delErrA || !deletedA || deletedA.is_active !== false) throw new Error('Failed to soft delete item A')
  console.log('✅ deleteInventoryItem performs soft-delete (is_active = false)')

  console.log('--- ALL INVENTORY REPO TESTS PASSED ---')
}

run().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
