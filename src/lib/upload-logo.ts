'use client'

// Shared by every "upload a logo" surface (Branding's default-brand form,
// the Brands page's per-brand edit form) — one real Supabase Storage
// upload path, not duplicated per form. pathSegment scopes the storage
// object so multiple brands under the same tenant never collide/overwrite
// each other's logo.
export async function uploadLogoFile(
  file: File,
  tenantId: string,
  pathSegment: string
): Promise<{ publicUrl: string } | { error: string }> {
  const supabase = (await import('@/lib/supabase/client')).createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { error: 'Not authenticated - please log in again' }
  }

  const ext = file.name.split('.').pop() || 'png'
  const storagePath = `${tenantId}/${pathSegment}/logo.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('tenant-logos')
    .upload(storagePath, file, { upsert: true })

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` }
  }

  const { data } = supabase.storage.from('tenant-logos').getPublicUrl(storagePath)
  return { publicUrl: data.publicUrl }
}
