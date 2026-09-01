'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Minus, Box, Save, Info } from 'lucide-react'
import { INVENTORY_ROOMS } from '@/modules/inventory/schemas'
import { saveQuoteInventoryAction } from '../../actions'
import { formatZodIssues } from '@/lib/format-zod-error'

type CatalogItem = {
  id: string
  name: string
  room: string
  default_volume: number
  is_active: boolean
}

type QuoteInventoryItem = {
  inventory_item_id: string
  room: string | null
  quantity: number
  item_name: string
  volume: number
}

type Quote = {
  id: string
  status: string
  total_volume: number | null
}

type Selection = {
  inventory_item_id: string
  room: string
  quantity: number
  item_name: string
  base_volume: number
  is_catalog_active: boolean
}

export function VolumeCalculator({
  quote,
  initialSelections,
  catalog,
}: {
  quote: Quote
  initialSelections: QuoteInventoryItem[]
  catalog: CatalogItem[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  
  // 1. Initialize state
  const [selections, setSelections] = useState<Record<string, Selection>>(() => {
    const map: Record<string, Selection> = {}
    
    // Load initial selections (with soft-delete safety)
    initialSelections.forEach((item) => {
      // Find in catalog to check if active
      const catItem = catalog.find(c => c.id === item.inventory_item_id)
      map[item.inventory_item_id] = {
        inventory_item_id: item.inventory_item_id,
        room: item.room || 'Unassigned',
        quantity: item.quantity,
        item_name: item.item_name,
        // Calculate base volume from total row volume snapshot
        base_volume: item.quantity > 0 ? item.volume / item.quantity : 0,
        is_catalog_active: !!catItem
      }
    })
    
    return map
  })

  // Group catalog by room
  const catalogByRoom = INVENTORY_ROOMS.reduce((acc, room) => {
    acc[room] = catalog.filter(c => c.room === room)
    return acc
  }, {} as Record<string, CatalogItem[]>)

  const updateQuantity = (item: CatalogItem | Selection, delta: number) => {
    if (quote.status !== 'draft') return // strict mutability UI guard
    
    setSelections(prev => {
      const itemId = 'id' in item ? item.id : (item as Selection).inventory_item_id
      const existing = prev[itemId]
      const currentQty = existing?.quantity || 0
      const newQty = Math.max(0, currentQty + delta)
      
      const newSelections = { ...prev }
      
      if (newQty === 0) {
        // If it goes to 0, remove it
        delete newSelections[item.id || (item as Selection).inventory_item_id]
      } else {
        // Update or insert
        if (existing) {
          newSelections[existing.inventory_item_id] = { ...existing, quantity: newQty }
        } else {
          // It's a new item from catalog
          const catItem = item as CatalogItem
          newSelections[catItem.id] = {
            inventory_item_id: catItem.id,
            room: catItem.room,
            quantity: newQty,
            item_name: catItem.name,
            base_volume: catItem.default_volume,
            is_catalog_active: true
          }
        }
      }
      
      return newSelections
    })
  }

  const handleSave = () => {
    if (quote.status !== 'draft') return

    setError(null)
    startTransition(async () => {
      const payload = {
        items: Object.values(selections).map(s => ({
          inventory_item_id: s.inventory_item_id,
          room: s.room,
          quantity: s.quantity,
          item_name: s.item_name,
          volume: s.base_volume // Server RPC multiplies this by quantity
        }))
      }

      const result = await saveQuoteInventoryAction(quote.id, payload)
      if (!result.success) {
        setError('details' in result && result.details ? formatZodIssues(result.details) : result.error || 'Failed to save inventory')
      }
    })
  }

  const selectedList = Object.values(selections)
  const grandTotal = selectedList.reduce((sum, item) => sum + (item.quantity * item.base_volume), 0)
  const isDraft = quote.status === 'draft'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Pane: Catalog */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 pb-4">
            <CardTitle className="text-lg">Inventory Catalog</CardTitle>
            <CardDescription>Select items to calculate volume</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-8">
            {INVENTORY_ROOMS.map(room => {
              const roomItems = catalogByRoom[room] || []
              if (roomItems.length === 0) return null

              return (
                <div key={room}>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">{room}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roomItems.map(item => {
                      const selected = selections[item.id]
                      const qty = selected?.quantity || 0

                      return (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.default_volume} cft</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              disabled={qty === 0 || !isDraft}
                              onClick={() => updateQuantity(item, -1)}
                              title={`Decrease quantity of ${item.name}`}
                              aria-label={`Decrease quantity of ${item.name}`}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-sm font-medium w-4 text-center">{qty}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              disabled={!isDraft}
                              onClick={() => updateQuantity(item, 1)}
                              title={`Increase quantity of ${item.name}`}
                              aria-label={`Increase quantity of ${item.name}`}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Right Pane: Summary */}
      <div className="space-y-6">
        <Card className="shadow-sm border-slate-200 sticky top-6">
          <CardHeader className="bg-slate-50/50 pb-4 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center justify-between">
              Summary
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                {grandTotal.toFixed(1)} cft
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
              {selectedList.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-8">
                  <Box className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  No items selected
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedList.map(item => (
                    <div key={item.inventory_item_id} className="flex items-start justify-between text-sm">
                      <div>
                        <p className="font-medium text-slate-900">
                          {item.quantity}x {item.item_name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-slate-500">{item.room}</p>
                          {!item.is_catalog_active && (
                            <Badge variant="outline" className="text-[9px] uppercase border-amber-200 text-amber-700 bg-amber-50">
                              Legacy
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="font-medium text-slate-700">
                        {(item.quantity * item.base_volume).toFixed(1)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-slate-900">Total Volume</span>
                <span className="font-bold text-lg text-slate-900">{grandTotal.toFixed(1)} cft</span>
              </div>

              {!isDraft && (
                <div className="mb-4 flex gap-2 p-3 bg-amber-50 text-amber-800 rounded-md text-xs">
                  <Info className="h-4 w-4 shrink-0" />
                  This quote is no longer a draft. Inventory modifications are locked.
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 text-sm bg-red-50 border border-red-200 text-red-600 rounded-md">
                  {error}
                </div>
              )}

              <Button
                className="w-full" 
                onClick={handleSave} 
                disabled={isPending || !isDraft}
              >
                {isPending ? 'Saving...' : 'Save Inventory'}
                {!isPending && <Save className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
