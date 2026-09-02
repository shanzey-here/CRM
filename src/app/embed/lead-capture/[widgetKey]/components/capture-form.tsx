'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { publicWidgetFormSchema, type PublicWidgetFormInput } from '../schema'
import { publicCaptureAction } from '../actions'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface CaptureFormProps {
  widgetKey: string
  tenantName: string
  brandColor: string
}

const TITLE_OPTIONS = ['Mr', 'Mrs', 'Miss', 'Dr', 'Prof'] as const
const PROPERTY_TYPE_OPTIONS = [
  { value: 'house', label: 'House' },
  { value: 'flat', label: 'Flat' },
  { value: 'office', label: 'Office' },
  { value: 'storage', label: 'Storage' },
  { value: 'shop', label: 'Shop' },
] as const
const PACKING_OPTIONS = [
  { value: 'none', label: 'No packing' },
  { value: 'kitchen_fragile', label: 'Kitchen & fragile only' },
  { value: 'full', label: 'Full packing' },
] as const

// Shared pill-style radio group — matches the reference's radio-button
// selection pattern (not dropdowns) for Title/Property Type/Packing, brand
// color used only for the selected state so it stays legible against any
// tenant's real accent color.
function RadioPillGroup<T extends string>({
  options,
  value,
  onChange,
  brandColor,
  name,
}: {
  options: readonly { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
  brandColor: string
  name: string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
            style={
              selected
                ? { backgroundColor: brandColor, borderColor: brandColor, color: '#fff' }
                : { backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#334155' }
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

export function CaptureForm({ widgetKey, tenantName, brandColor }: CaptureFormProps) {
  const [isSuccess, setIsSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<PublicWidgetFormInput>({
    resolver: zodResolver(publicWidgetFormSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      preferred_move_date: '',
      preferred_move_time: '',
      origin_house_number: '',
      origin_city: '',
      origin_postcode: '',
      destination_house_number: '',
      destination_city: '',
      destination_postcode: '',
      notes: '',
      website_url: '', // honeypot
    },
  })

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = form

  const title = watch('title')
  const originPropertyType = watch('origin_property_type')
  const destinationPropertyType = watch('destination_property_type')
  const packingPreference = watch('packing_preference')

  const onSubmit = async (data: PublicWidgetFormInput) => {
    setServerError(null)
    const result = await publicCaptureAction(widgetKey, data)

    if (result.success) {
      setIsSuccess(true)
    } else {
      setServerError(result.error || 'Something went wrong. Please try again.')
    }
  }

  if (isSuccess) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-border p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Received</h2>
        <p className="text-gray-500">Thank you for reaching out to {tenantName}. We'll be in touch shortly!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-border p-6 overflow-hidden flex flex-col">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Request a Quote</h2>
        <p className="text-gray-500 text-sm">Fill out the details below and {tenantName} will get back to you.</p>
      </div>

      {serverError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-5 text-sm border border-red-100">
          {serverError}
        </div>
      )}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {/* Honeypot Field - Visually Hidden */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website_url">Website URL (Leave blank)</label>
          <input type="text" id="website_url" tabIndex={-1} autoComplete="off" {...register('website_url')} />
        </div>

        {/* Your Details */}
        <SectionCard title="Your Details">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <RadioPillGroup
              name="title"
              options={TITLE_OPTIONS.map((t) => ({ value: t, label: t }))}
              value={title}
              onChange={(v) => setValue('title', v)}
              brandColor={brandColor}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="first_name" className="flex items-center gap-1">Full Name <span className="text-red-500">*</span></Label>
            <Input id="first_name" placeholder="Jane Doe" {...register('first_name')} />
            {errors.first_name && <p className="text-sm text-red-500">{errors.first_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="flex items-center gap-1">Email <span className="text-red-500">*</span></Label>
              <Input id="email" type="email" placeholder="jane@example.com" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="flex items-center gap-1">Phone <span className="text-red-500">*</span></Label>
              <Input id="phone" type="tel" placeholder="07123 456789" {...register('phone')} />
              {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
            </div>
          </div>
        </SectionCard>

        {/* Moving Details */}
        <SectionCard title="Moving Details">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="preferred_move_date" className="flex items-center gap-1">Moving Date <span className="text-red-500">*</span></Label>
              <Input id="preferred_move_date" type="date" {...register('preferred_move_date')} />
              {errors.preferred_move_date && <p className="text-sm text-red-500">{errors.preferred_move_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferred_move_time">Preferred Time to Start</Label>
              <Input id="preferred_move_time" type="time" {...register('preferred_move_time')} />
              {errors.preferred_move_time && <p className="text-sm text-red-500">{errors.preferred_move_time.message}</p>}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900">Moving From</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="origin_house_number" className="flex items-center gap-1 text-xs">House Number <span className="text-red-500">*</span></Label>
                <Input id="origin_house_number" placeholder="12" {...register('origin_house_number')} />
                {errors.origin_house_number && <p className="text-xs text-red-500">{errors.origin_house_number.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="origin_city" className="flex items-center gap-1 text-xs">City <span className="text-red-500">*</span></Label>
                <Input id="origin_city" placeholder="London" {...register('origin_city')} />
                {errors.origin_city && <p className="text-xs text-red-500">{errors.origin_city.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="origin_postcode" className="flex items-center gap-1 text-xs">Postcode <span className="text-red-500">*</span></Label>
              <Input id="origin_postcode" placeholder="E1 6AN" {...register('origin_postcode')} />
              {errors.origin_postcode && <p className="text-xs text-red-500">{errors.origin_postcode.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-xs">Property Type <span className="text-red-500">*</span></Label>
              <RadioPillGroup
                name="origin_property_type"
                options={PROPERTY_TYPE_OPTIONS}
                value={originPropertyType}
                onChange={(v) => setValue('origin_property_type', v)}
                brandColor={brandColor}
              />
              {errors.origin_property_type && <p className="text-xs text-red-500">{errors.origin_property_type.message}</p>}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900">Moving To</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="destination_house_number" className="flex items-center gap-1 text-xs">House Number <span className="text-red-500">*</span></Label>
                <Input id="destination_house_number" placeholder="4" {...register('destination_house_number')} />
                {errors.destination_house_number && <p className="text-xs text-red-500">{errors.destination_house_number.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destination_city" className="flex items-center gap-1 text-xs">City <span className="text-red-500">*</span></Label>
                <Input id="destination_city" placeholder="Manchester" {...register('destination_city')} />
                {errors.destination_city && <p className="text-xs text-red-500">{errors.destination_city.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destination_postcode" className="flex items-center gap-1 text-xs">Postcode <span className="text-red-500">*</span></Label>
              <Input id="destination_postcode" placeholder="M1 1AD" {...register('destination_postcode')} />
              {errors.destination_postcode && <p className="text-xs text-red-500">{errors.destination_postcode.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-xs">Property Type <span className="text-red-500">*</span></Label>
              <RadioPillGroup
                name="destination_property_type"
                options={PROPERTY_TYPE_OPTIONS}
                value={destinationPropertyType}
                onChange={(v) => setValue('destination_property_type', v)}
                brandColor={brandColor}
              />
              {errors.destination_property_type && <p className="text-xs text-red-500">{errors.destination_property_type.message}</p>}
            </div>
          </div>
        </SectionCard>

        {/* Additional Info / Services Required */}
        <SectionCard title="Additional Info / Services Required">
          <div className="space-y-1.5">
            <Label className="text-xs">Packing of Boxes Service</Label>
            <RadioPillGroup
              name="packing_preference"
              options={PACKING_OPTIONS}
              value={packingPreference}
              onChange={(v) => setValue('packing_preference', v)}
              brandColor={brandColor}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Items to be moved</Label>
            <Textarea
              id="notes"
              placeholder="Tell us about what you're moving (e.g. 2 bedroom flat, mostly boxes, 1 large sofa...)"
              className="h-24 resize-none"
              {...register('notes')}
            />
          </div>
        </SectionCard>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-full text-base font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {isSubmitting ? 'Sending Request...' : 'Request a Quote'}
          </button>
        </div>
      </form>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
      `}} />
    </div>
  )
}
