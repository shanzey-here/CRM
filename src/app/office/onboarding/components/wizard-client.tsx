'use client'

import { useState } from 'react'
import { updateBrandingAction } from '@/app/office/settings/branding/actions'
import { updatePricingAction } from '@/app/office/settings/pricing/actions'
import { skipOnboardingAction, completeOnboardingAction } from '../actions'
import { Loader2, Check } from 'lucide-react'

// Starter Catalog Data
const STARTER_INVENTORY = [
  { room: 'bedroom', name: 'Single Bed', default_volume: 40 },
  { room: 'bedroom', name: 'Double Bed', default_volume: 60 },
  { room: 'bedroom', name: 'King Size Bed', default_volume: 70 },
  { room: 'bedroom', name: 'Wardrobe - Single', default_volume: 30 },
  { room: 'bedroom', name: 'Wardrobe - Double', default_volume: 60 },
  { room: 'bedroom', name: 'Chest of Drawers', default_volume: 25 },
  { room: 'bedroom', name: 'Bedside Table', default_volume: 5 },
  
  { room: 'living_room', name: 'Armchair', default_volume: 25 },
  { room: 'living_room', name: '2-Seater Sofa', default_volume: 50 },
  { room: 'living_room', name: '3-Seater Sofa', default_volume: 75 },
  { room: 'living_room', name: 'TV Unit', default_volume: 20 },
  { room: 'living_room', name: 'Coffee Table', default_volume: 15 },
  { room: 'living_room', name: 'Bookcase', default_volume: 30 },
  { room: 'living_room', name: 'Rug (rolled)', default_volume: 10 },

  { room: 'dining_room', name: 'Dining Table', default_volume: 40 },
  { room: 'dining_room', name: 'Dining Chair', default_volume: 5 },
  { room: 'kitchen', name: 'Fridge Freezer (tall)', default_volume: 45 },
  { room: 'kitchen', name: 'Washing Machine', default_volume: 20 },
  { room: 'kitchen', name: 'Dishwasher', default_volume: 20 },
  { room: 'kitchen', name: 'Microwave', default_volume: 3 },

  { room: 'outdoor', name: 'Bicycle', default_volume: 15 },
  { room: 'outdoor', name: 'Lawn Mower', default_volume: 15 },
  { room: 'outdoor', name: 'BBQ', default_volume: 20 },
  { room: 'garage', name: 'Tool Box (large)', default_volume: 10 },
  { room: 'outdoor', name: 'Garden Chair', default_volume: 5 },

  { room: 'other', name: 'Standard Box (Medium)', default_volume: 3 },
  { room: 'other', name: 'Large Box (Tea Carton)', default_volume: 5 },
  { room: 'bedroom', name: 'Wardrobe Box', default_volume: 15 },
  { room: 'other', name: 'Suitcase (large)', default_volume: 5 },
  { room: 'other', name: 'Vacuum Cleaner', default_volume: 5 },
]

export function WizardClient({ initialBranding, initialPricing }: any) {
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  
  // Inventory state
  const [selectedItems, setSelectedItems] = useState(
    STARTER_INVENTORY.map(item => ({ ...item, selected: true }))
  )

  const handleSkip = async () => {
    setIsLoading(true)
    await skipOnboardingAction()
  }

  const handleBrandingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    await updateBrandingAction(formData)
    setStep(2)
    setIsLoading(false)
  }

  const handlePricingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    await updatePricingAction(formData)
    setStep(3)
    setIsLoading(false)
  }

  const handleInventorySubmit = async () => {
    setIsLoading(true)
    const itemsToInsert = selectedItems.filter(i => i.selected).map(({ selected, ...rest }) => rest)
    await completeOnboardingAction(itemsToInsert)
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[600px]">
      {/* Sidebar Stepper */}
      <div className="w-full md:w-64 bg-slate-950/50 p-6 border-r border-slate-800">
        <ul className="space-y-6">
          <li className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {step > 1 ? <Check size={16} /> : '1'}
            </div>
            <span className={`font-medium ${step >= 1 ? 'text-white' : 'text-slate-400'}`}>Branding</span>
          </li>
          <li className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {step > 2 ? <Check size={16} /> : '2'}
            </div>
            <span className={`font-medium ${step >= 2 ? 'text-white' : 'text-slate-400'}`}>Rates & Pricing</span>
          </li>
          <li className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              3
            </div>
            <span className={`font-medium ${step >= 3 ? 'text-white' : 'text-slate-400'}`}>Starter Catalog</span>
          </li>
        </ul>
        <div className="mt-12">
           <p className="text-xs text-slate-500 mb-2">Note: Each step saves immediately. You can safely skip at any time.</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8">
        
        {/* STEP 1: BRANDING */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-semibold text-white mb-6">Company Branding</h2>
            <form onSubmit={handleBrandingSubmit} className="space-y-6 max-w-md">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Company Legal Name</label>
                <input 
                  name="company_legal_name" 
                  defaultValue={initialBranding?.company_legal_name || ''} 
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Primary Brand Color</label>
                <div className="flex gap-3">
                  <input 
                    name="primary_color" 
                    type="color"
                    defaultValue={initialBranding?.primary_color || '#1a56db'} 
                    className="h-10 w-20 bg-slate-950 border border-slate-800 rounded-md cursor-pointer"
                  />
                  <input 
                    type="text"
                    defaultValue={initialBranding?.primary_color || '#1a56db'} 
                    readOnly
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-md px-4 py-2 text-slate-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-8 border-t border-slate-800">
                <button type="button" onClick={handleSkip} disabled={isLoading} className="text-slate-400 hover:text-white transition-colors">
                  Skip for now
                </button>
                <button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium flex items-center gap-2">
                  {isLoading && <Loader2 size={16} className="animate-spin" />} Save & Continue
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: PRICING */}
        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-semibold text-white mb-6">Default Rates</h2>
            <form onSubmit={handlePricingSubmit} className="space-y-6 max-w-md">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Base Rate ($)</label>
                  <input 
                    name="base_rate" 
                    type="number" step="0.01" min="0"
                    defaultValue={initialPricing?.base_rate || 50} 
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Per Mile Rate ($)</label>
                  <input 
                    name="per_mile_rate" 
                    type="number" step="0.01" min="0"
                    defaultValue={initialPricing?.per_mile_rate || 2.50} 
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Volume Rate ($/cuft)</label>
                  <input 
                    name="per_cuft_rate" 
                    type="number" step="0.01" min="0"
                    defaultValue={initialPricing?.per_cuft_rate || 1.20} 
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Labor Rate ($/hr)</label>
                  <input 
                    name="labor_rate_per_hour" 
                    type="number" step="0.01" min="0"
                    defaultValue={initialPricing?.labor_rate_per_hour || 35} 
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-8 border-t border-slate-800">
                <button type="button" onClick={handleSkip} disabled={isLoading} className="text-slate-400 hover:text-white transition-colors">
                  Skip for now
                </button>
                <button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium flex items-center gap-2">
                  {isLoading && <Loader2 size={16} className="animate-spin" />} Save & Continue
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: INVENTORY CATALOG */}
        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white mb-2">Starter Catalog</h2>
              <p className="text-slate-400">Review the starter inventory items. These are required for generating accurate quotes based on cubic volume. Uncheck any items you don't want to import.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-950 border border-slate-800 rounded-lg p-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
                {selectedItems.map((item, idx) => (
                  <label key={idx} className="flex items-center justify-between p-3 rounded bg-slate-900 border border-slate-800 hover:border-blue-500/50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => {
                          const newItems = [...selectedItems]
                          newItems[idx].selected = e.target.checked
                          setSelectedItems(newItems)
                        }}
                        className="w-4 h-4 rounded border-slate-700 text-blue-600 bg-slate-950"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{item.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{item.room.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded">
                      {item.default_volume} cu ft
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 mt-2 border-t border-slate-800 shrink-0">
              <button type="button" onClick={handleSkip} disabled={isLoading} className="text-slate-400 hover:text-white transition-colors">
                Skip for now
              </button>
              <button type="button" onClick={handleInventorySubmit} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium flex items-center gap-2">
                {isLoading && <Loader2 size={16} className="animate-spin" />} Finish & Import Catalog
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
