'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { insertInventoryItemSchema, INVENTORY_ROOMS, InsertInventoryInput } from '@/modules/inventory/schemas'
import { updateInventoryAction } from '../actions'

type InventoryItem = {
  id: string
  name: string
  room: string | null
  default_volume: number
  is_active: boolean
}

import { z } from 'zod'

export function EditInventoryForm({ item, onClose }: { item: InventoryItem, onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // We reuse InsertInventoryInput because edit requires the same base fields (no partial defaults here for safety)
  const { register, handleSubmit, formState: { errors } } = useForm<z.input<typeof insertInventoryItemSchema>>({
    resolver: zodResolver(insertInventoryItemSchema),
    defaultValues: {
      name: item.name,
      room: item.room as any, // Cast to any to satisfy the enum schema if it matches, otherwise null
      default_volume: item.default_volume,
      is_active: item.is_active
    }
  })

  const onSubmit = (data: z.input<typeof insertInventoryItemSchema>) => {
    startTransition(async () => {
      try {
        setError(null)
        const formData = new FormData()
        formData.append('name', data.name)
        if (data.room) formData.append('room', data.room)
        formData.append('default_volume', String(data.default_volume))
        formData.append('is_active', data.is_active ? 'true' : 'false')

        await updateInventoryAction(item.id, formData)
        onClose()
      } catch (err: any) {
        setError(err.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

        <div className="inline-block transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">Edit Inventory Item</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
              {error && <div className="text-sm text-red-600">{error}</div>}
              
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                <div className="mt-1">
                  <input
                    type="text"
                    {...register('name')}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  {errors.name && <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="room" className="block text-sm font-medium text-gray-700">Room</label>
                <div className="mt-1">
                  <select
                    {...register('room')}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select a room...</option>
                    {INVENTORY_ROOMS.map(room => (
                      <option key={room} value={room}>{room.replace('_', ' ')}</option>
                    ))}
                  </select>
                  {errors.room && <p className="mt-2 text-sm text-red-600">{errors.room.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="default_volume" className="block text-sm font-medium text-gray-700">Default Volume (cubic feet)</label>
                <div className="mt-1">
                  <input
                    type="number"
                    step="0.01"
                    {...register('default_volume')}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  {errors.default_volume && <p className="mt-2 text-sm text-red-600">{errors.default_volume.message}</p>}
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex h-5 items-center">
                  <input
                    type="checkbox"
                    {...register('is_active')}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="is_active" className="font-medium text-gray-700">Active</label>
                  <p className="text-gray-500">Item will be available for quoting.</p>
                </div>
              </div>

              <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
