'use client'

import { useState } from 'react'
import { CreateInventoryForm } from './create-inventory-form'
import { EditInventoryForm } from './edit-inventory-form'
import { deleteInventoryAction } from '../actions'

type InventoryItem = {
  id: string
  name: string
  room: string | null
  default_volume: number
  is_active: boolean
}

export function InventoryList({ items }: { items: InventoryItem[] }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

  const activeItems = items.filter(i => i.is_active)

  return (
    <div className="mt-8 flow-root">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold leading-6 text-gray-900">Items</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all active items in your catalog.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Add item
          </button>
        </div>
      </div>

      <div className="-mx-4 mt-8 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:-mx-6 md:mx-0 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Name</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Room</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Default Volume (cft)</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {activeItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 pl-4 pr-3 text-sm text-gray-500 text-center sm:pl-6">
                  No items found. Create one to get started.
                </td>
              </tr>
            ) : (
              activeItems.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                    {item.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.room || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{item.default_volume}</td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Edit<span className="sr-only">, {item.name}</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete ${item.name}?`)) {
                          await deleteInventoryAction(item.id)
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete<span className="sr-only">, {item.name}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isCreateOpen && (
        <CreateInventoryForm onClose={() => setIsCreateOpen(false)} />
      )}

      {editingItem && (
        <EditInventoryForm item={editingItem} onClose={() => setEditingItem(null)} />
      )}
    </div>
  )
}
