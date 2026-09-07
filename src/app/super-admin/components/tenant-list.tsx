import { getTenants } from '../actions'
import { TenantTable } from './tenant-table'

export async function TenantList() {
  const tenants = await getTenants()

  return <TenantTable tenants={tenants ?? []} />
}
