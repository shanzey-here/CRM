'use server'

import { createClient } from '@/lib/supabase/server'
import { getRepeatCustomers, getConversionFunnel, getContactLtv } from '@/modules/analytics/server/repository'

type OfficeStaffGuard =
  | { error: 'Unauthorized' | 'No tenant context' | 'Forbidden' }
  | { supabase: Awaited<ReturnType<typeof createClient>>; tenantId: string }

async function requireOfficeStaff(): Promise<OfficeStaffGuard> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) return { error: 'No tenant context' }

  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    return { error: 'Forbidden' }
  }

  return { supabase, tenantId }
}

export type FunnelResult =
  | { success: true; data: Awaited<ReturnType<typeof getConversionFunnel>> }
  | { success: false; error: string; code?: string }

export async function getFunnelAction(startDate: string, endDate: string): Promise<FunnelResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  
  const { supabase, tenantId } = guard

  try {
    const data = await getConversionFunnel(supabase, tenantId, startDate, endDate)
    return { success: true, data }
  } catch (err: any) {
    if (err?.code === 'PT403') {
      return { success: false, error: 'Tenant lacks analytics entitlement', code: 'PT403' }
    }
    return { success: false, error: err?.message || 'Failed to load funnel data' }
  }
}

export type RepeatCustomerWithDetails = {
  contact_id: string
  first_name: string
  last_name: string | null
  email: string | null
  completed_jobs_count: number
}

export type RepeatCustomersResult =
  | { success: true; data: RepeatCustomerWithDetails[] }
  | { success: false; error: string; code?: string }

export async function getRepeatCustomersAction(): Promise<RepeatCustomersResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  
  const { supabase, tenantId } = guard

  try {
    const raw = await getRepeatCustomers(supabase, tenantId)
    
    if (!raw.length) {
      return { success: true, data: [] }
    }

    const contactIds = raw.map(r => r.contact_id)
    const { data: contacts, error: fetchErr } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email')
      .in('id', contactIds)
      .eq('tenant_id', tenantId)

    if (fetchErr) throw fetchErr

    const contactMap = new Map(contacts?.map(c => [c.id, c]))

    const detailed = raw.map(r => {
      const c = contactMap.get(r.contact_id)
      return {
        contact_id: r.contact_id,
        first_name: c?.first_name || 'Unknown',
        last_name: c?.last_name || null,
        email: c?.email || null,
        completed_jobs_count: r.completed_jobs_count
      }
    })

    // Sort highest jobs first
    detailed.sort((a, b) => b.completed_jobs_count - a.completed_jobs_count)

    return { success: true, data: detailed }
  } catch (err: any) {
    if (err?.code === 'PT403') {
      return { success: false, error: 'Tenant lacks analytics entitlement', code: 'PT403' }
    }
    return { success: false, error: err?.message || 'Failed to load repeat customers' }
  }
}

export type LtvResult =
  | { success: true; data: number }
  | { success: false; error: string; code?: string }

export async function getContactLtvAction(contactId: string): Promise<LtvResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  
  const { supabase, tenantId } = guard

  try {
    const ltv = await getContactLtv(supabase, tenantId, contactId)
    return { success: true, data: ltv }
  } catch (err: any) {
    if (err?.code === 'PT403') {
      return { success: false, error: 'Tenant lacks analytics entitlement', code: 'PT403' }
    }
    return { success: false, error: err?.message || 'Failed to load LTV' }
  }
}
