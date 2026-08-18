import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type TenantSettingsRow = Database['public']['Tables']['tenant_settings']['Row']

export async function getTenantSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string
) {
  const { data, error } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  return { data, error }
}

export async function updateTenantSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  updates: Partial<TenantSettingsRow>
) {
  const { data, error } = await supabase
    .from('tenant_settings')
    .update(updates)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  return { data, error }
}

export async function uploadTenantLogo(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  file: File
) {
  // Generate filename: logo.<ext>
  const ext = file.name.split('.').pop() || 'png'
  const storagePath = `${tenantId}/logo.${ext}`

  // Convert File to buffer
  const buffer = await file.arrayBuffer()

  // Upload to storage
  const { error: uploadError, data: uploadData } = await supabase.storage
    .from('tenant-logos')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return { error: uploadError }
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('tenant-logos')
    .getPublicUrl(storagePath)

  return {
    data: {
      path: uploadData.path,
      publicUrl: publicUrlData.publicUrl,
    },
    error: null,
  }
}
