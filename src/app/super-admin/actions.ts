'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getTenants() {
  const supabase = await createClient()
  
  // 1. Strict Server-Side Guard
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }

  // 2. Fetch Tenants
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch tenants: ${error.message}`)
  }

  return data
}

export async function createTenant(formData: FormData) {
  const supabase = await createClient()

  // 1. Strict Server-Side Guard
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }

  // 2. Validation
  const name = formData.get('name') as string
  const slug = formData.get('slug') as string

  if (!name || name.trim() === '') {
    return { error: 'Name is required' }
  }
  
  if (!slug || slug.trim() === '') {
    return { error: 'Slug is required' }
  }

  // Basic slug format validation (alphanumeric and hyphens only)
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: 'Slug can only contain lowercase letters, numbers, and hyphens' }
  }

  // 3. Uniqueness Check
  const { data: existing, error: checkError } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()
    
  if (existing) {
    return { error: 'A tenant with this slug already exists. Please choose a unique slug.' }
  }
  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    return { error: 'Failed to validate slug uniqueness' }
  }

  // 4. Insert New Tenant
  const { error: insertError } = await supabase
    .from('tenants')
    .insert([{ name: name.trim(), slug: slug.trim(), status: 'active' }])

  if (insertError) {
    return { error: `Failed to create tenant: ${insertError.message}` }
  }

  // 5. Revalidate
  revalidatePath('/super-admin')
  return { success: true }
}
