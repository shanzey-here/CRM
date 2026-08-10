'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { publicWidgetFormSchema, type PublicWidgetFormInput } from '../schema'
import { publicCaptureAction } from '../actions'

// Standard UI components from your CRM (assuming standard Shadcn-like setup)
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface CaptureFormProps {
  widgetKey: string
  tenantName: string
}

export function CaptureForm({ widgetKey, tenantName }: CaptureFormProps) {
  const [isSuccess, setIsSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  
  const form = useForm<PublicWidgetFormInput>({
    resolver: zodResolver(publicWidgetFormSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      origin_city: '',
      origin_postcode: '',
      destination_city: '',
      destination_postcode: '',
      preferred_move_date: '',
      notes: '',
      website_url: '' // honeypot
    }
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = form

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
      <div className="bg-white rounded-xl shadow-lg border border-border p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
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
    <div className="bg-white rounded-xl shadow-lg border border-border p-6 overflow-hidden flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Request a Quote</h2>
        <p className="text-gray-500 text-sm">Fill out the details below and {tenantName} will get back to you.</p>
      </div>

      {serverError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-6 text-sm border border-red-100">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {/* Honeypot Field - Visually Hidden */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="website_url">Website URL (Leave blank)</label>
          <input type="text" id="website_url" tabIndex={-1} autoComplete="off" {...register('website_url')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="first_name">First Name</Label>
            <Input id="first_name" placeholder="John" {...register('first_name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last_name">Last Name</Label>
            <Input id="last_name" placeholder="Doe" {...register('last_name')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="flex items-center gap-1">Email <span className="text-red-500">*</span></Label>
            <Input id="email" type="email" placeholder="john@example.com" {...register('email')} />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="flex items-center gap-1">Phone <span className="text-red-500">*</span></Label>
            <Input id="phone" type="tel" placeholder="07123 456789" {...register('phone')} />
            {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 pt-2 border-t border-gray-100">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Moving From</h3>
            <div className="space-y-1.5">
              <Label htmlFor="origin_city" className="text-xs">City</Label>
              <Input id="origin_city" placeholder="London" {...register('origin_city')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="origin_postcode" className="text-xs">Postcode</Label>
              <Input id="origin_postcode" placeholder="E1 6AN" {...register('origin_postcode')} />
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Moving To</h3>
            <div className="space-y-1.5">
              <Label htmlFor="destination_city" className="text-xs">City</Label>
              <Input id="destination_city" placeholder="Manchester" {...register('destination_city')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destination_postcode" className="text-xs">Postcode</Label>
              <Input id="destination_postcode" placeholder="M1 1AD" {...register('destination_postcode')} />
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-gray-100">
          <Label htmlFor="preferred_move_date">Preferred Move Date</Label>
          <Input id="preferred_move_date" type="date" {...register('preferred_move_date')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Additional Details / Inventory</Label>
          <Textarea 
            id="notes" 
            placeholder="Tell us about what you're moving (e.g. 2 bedroom flat, mostly boxes, 1 large sofa...)" 
            className="h-24 resize-none"
            {...register('notes')} 
          />
        </div>

        <div className="pt-4">
          <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isSubmitting}>
            {isSubmitting ? 'Sending Request...' : 'Request a Quote'}
          </Button>
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
