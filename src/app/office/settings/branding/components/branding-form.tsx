'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { tenantSettingsSchema, TenantSettingsInput } from '@/modules/settings/branding/schemas'
import { updateBrandingAction, uploadLogoAction } from '../actions'

type BrandingFormData = Omit<TenantSettingsInput, 'logo_url'>

interface Props {
  settings: any
}

export function BrandingForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition()
  const [logoPreview, setLogoPreview] = useState<string | null>(settings?.logo_url || null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BrandingFormData>({
    resolver: zodResolver(tenantSettingsSchema.omit({ logo_url: true })),
    defaultValues: {
      company_legal_name: settings?.company_legal_name || '',
      address_line_1: settings?.address_line_1 || '',
      address_line_2: settings?.address_line_2 || '',
      address_city: settings?.address_city || '',
      address_county: settings?.address_county || '',
      address_postcode: settings?.address_postcode || '',
      address_country: settings?.address_country || 'GB',
      vat_number: settings?.vat_number || '',
      phone: settings?.phone || '',
      email: settings?.email || '',
      website: settings?.website || '',
      terms_template: settings?.terms_template || '',
      primary_color: settings?.primary_color || '#1a56db',
    },
  })

  const primaryColor = watch('primary_color')

  const onSubmit = (data: BrandingFormData) => {
    startTransition(async () => {
      try {
        setError(null)
        const formData = new FormData()
        Object.entries(data).forEach(([key, value]) => {
          formData.append(key, value || '')
        })
        await updateBrandingAction(formData)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update branding')
      }
    })
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Direct client upload to Supabase Storage, then update DB via Server Action
    startTransition(async () => {
      try {
        setError(null)
        const supabase = (await import('@/lib/supabase/client')).createClient()

        // Verify user is authenticated with a valid session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError('Not authenticated - please log in again')
          return
        }

        const user = session.user
        const tenantId = user?.app_metadata?.tenant_id
        const userRole = user?.app_metadata?.tenant_role

        if (!tenantId) {
          setError('No tenant context in your session')
          return
        }

        console.log('[Logo Upload] Session verified:', { tenantId, userRole, email: user?.email })

        // Upload to Storage directly from client (bypasses Server Action body limit)
        // Path must be: {tenantId}/{filename} for RLS policy to allow it
        const ext = file.name.split('.').pop() || 'png'
        const storagePath = `${tenantId}/logo.${ext}`

        console.log('[Logo Upload] Uploading to path:', storagePath)

        const { error: uploadError } = await supabase.storage
          .from('tenant-logos')
          .upload(storagePath, file, { upsert: true })

        if (uploadError) {
          console.error('[Logo Upload] Storage error:', uploadError)
          setError(`Upload failed: ${uploadError.message}`)
          return
        }

        // Get public URL
        const { data } = supabase.storage
          .from('tenant-logos')
          .getPublicUrl(storagePath)

        // Update DB with the public URL via Server Action
        const formData = new FormData()
        formData.append('logo_url', data.publicUrl)

        const result = await (await import('../actions')).updateBrandingLogoUrlAction(formData)
        if ('error' in result) {
          setError(result.error)
        } else {
          setSuccess(true)
          setTimeout(() => setSuccess(false), 3000)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            Changes saved successfully
          </div>
        )}

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-2">Logo</label>
          <div className="flex flex-col gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={isPending}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            />
            {logoPreview && (
              <div className="w-32 h-32 bg-slate-100 rounded flex items-center justify-center overflow-hidden">
                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
              </div>
            )}
          </div>
        </div>

        {/* Company Name */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">
            Company Legal Name
          </label>
          <input
            type="text"
            {...register('company_legal_name')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          {errors.company_legal_name && (
            <p className="text-sm text-red-600 mt-1">{errors.company_legal_name.message}</p>
          )}
        </div>

        {/* Address */}
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Address Line 1"
            {...register('address_line_1')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Address Line 2"
            {...register('address_line_2')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="City"
            {...register('address_city')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="County"
            {...register('address_county')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Postcode"
            {...register('address_postcode')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Country"
            {...register('address_country')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* Contact Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">VAT Number</label>
            <input
              type="text"
              {...register('vat_number')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Phone</label>
            <input
              type="tel"
              {...register('phone')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Website</label>
            <input
              type="url"
              {...register('website')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {errors.website && <p className="text-sm text-red-600 mt-1">{errors.website.message}</p>}
          </div>
        </div>

        {/* Primary Color */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">Primary Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              {...register('primary_color')}
              className="h-10 w-20 border border-slate-300 rounded cursor-pointer"
            />
            <input
              type="text"
              {...register('primary_color')}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          {errors.primary_color && (
            <p className="text-sm text-red-600 mt-1">{errors.primary_color.message}</p>
          )}
        </div>

        {/* Terms Template */}
        <div>
          <label className="block text-sm font-medium text-slate-900 mb-1">Terms Template</label>
          <textarea
            {...register('terms_template')}
            rows={6}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Saving...' : 'Save Branding Settings'}
        </button>
      </form>

      {/* Live Preview */}
      <div className="lg:col-span-1">
        <div className="sticky top-4 p-4 bg-white border border-slate-200 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Live Preview</h3>
          <div
            className="rounded border border-slate-200 overflow-hidden"
            style={{ backgroundColor: '#f8f8f8' }}
          >
            {/* Mock proposal header */}
            <div style={{ backgroundColor: primaryColor }} className="p-4 text-white">
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Company logo"
                  className="h-12 mb-2 object-contain"
                />
              )}
              <p className="text-sm font-semibold">Proposal</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-600 font-medium mb-2">From</p>
              <p className="font-semibold text-slate-900 text-sm mb-4">
                {settings?.company_legal_name || 'Your Company'}
              </p>
              {settings?.phone && (
                <p className="text-xs text-slate-600 mb-1">Phone: {settings.phone}</p>
              )}
              {settings?.email && (
                <p className="text-xs text-slate-600">Email: {settings.email}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
