'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useTransition } from 'react'
import { updateBrandingAction } from '../actions'
import { uploadLogoFile } from '@/lib/upload-logo'
import { optionalUkPostcodeSchema } from '@/lib/postcode-validation'

// Identity fields (from the default brand) + primary_color (from
// tenant_settings) — the two real data sources this form now writes to,
// via the same real updateBrand()/updateTenantSettings() the Brands page
// and Appearance-adjacent settings already use.
const brandingFormSchema = z.object({
  company_legal_name: z.string().min(1, 'Company name is required'),
  address_line_1: z.string().nullable().optional(),
  address_line_2: z.string().nullable().optional(),
  address_city: z.string().nullable().optional(),
  address_county: z.string().nullable().optional(),
  address_postcode: optionalUkPostcodeSchema,
  address_country: z.string().default('GB'),
  vat_number: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  website: z.string().url().nullable().optional().or(z.literal('')),
  terms_template: z.string().nullable().optional(),
  primary_color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Primary color must be a valid hex color (e.g., #1a56db)')
    .default('#1a56db'),
})

type BrandingFormData = z.infer<typeof brandingFormSchema>

interface Props {
  // The tenant's default brand (real identity data) + tenant_settings'
  // primary_color (the one field that's genuinely still tenant-wide).
  brand: any
  primaryColor: string
}

export function BrandingForm({ brand, primaryColor: initialPrimaryColor }: Props) {
  const [isPending, startTransition] = useTransition()
  const [logoPreview, setLogoPreview] = useState<string | null>(brand?.logo_url || null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BrandingFormData>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: {
      company_legal_name: brand?.name || '',
      address_line_1: brand?.address_line_1 || '',
      address_line_2: brand?.address_line_2 || '',
      address_city: brand?.address_city || '',
      address_county: brand?.address_county || '',
      address_postcode: brand?.address_postcode || '',
      address_country: brand?.address_country || 'GB',
      vat_number: brand?.vat_number || '',
      phone: brand?.phone || '',
      email: brand?.email || '',
      website: brand?.website || '',
      terms_template: brand?.terms_text || '',
      primary_color: initialPrimaryColor || '#1a56db',
    },
  })

  const primaryColor = watch('primary_color')

  const onSubmit = (data: BrandingFormData) => {
    startTransition(async () => {
      try {
        setError(null)
        const formData = new FormData()
        formData.append('logo_url', logoPreview && logoPreview.startsWith('http') ? logoPreview : brand?.logo_url || '')
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
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setError('Not authenticated - please log in again')
          return
        }
        const tenantId = session.user?.app_metadata?.tenant_id
        if (!tenantId) {
          setError('No tenant context in your session')
          return
        }

        const uploadResult = await uploadLogoFile(file, tenantId, brand?.id || 'default')
        if ('error' in uploadResult) {
          setError(uploadResult.error)
          return
        }

        setLogoPreview(uploadResult.publicUrl)

        const formData = new FormData()
        formData.append('logo_url', uploadResult.publicUrl)

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
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
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
        {errors.address_postcode && (
          <p className="text-xs text-red-500 mt-1">{errors.address_postcode.message}</p>
        )}

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
          <p className="text-xs text-slate-400 mb-2">Your customer portal's accent color — shared across all your brands, not brand-specific.</p>
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
                {brand?.name || 'Your Company'}
              </p>
              {brand?.phone && (
                <p className="text-xs text-slate-600 mb-1">Phone: {brand.phone}</p>
              )}
              {brand?.email && (
                <p className="text-xs text-slate-600">Email: {brand.email}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
