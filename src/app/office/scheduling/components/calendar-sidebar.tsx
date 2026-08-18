'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export function CalendarSidebar({ staff }: { staff: { id: string, full_name: string }[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeTypes = searchParams.get('type')?.split(',') || ['jobs', 'tasks', 'appointments']
  const activeCrew = searchParams.get('crew')?.split(',') || []

  const setType = useCallback((type: string, checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    let types = new Set(activeTypes)
    if (checked) {
      types.add(type)
    } else {
      types.delete(type)
    }
    
    if (types.size === 0) {
      params.set('type', 'none')
    } else if (types.size === 3) {
      params.delete('type')
    } else {
      params.set('type', Array.from(types).join(','))
    }
    router.push(`?${params.toString()}`)
  }, [searchParams, activeTypes, router])

  const setCrew = useCallback((crewId: string, checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    let crew = new Set(activeCrew)
    if (checked) {
      crew.add(crewId)
    } else {
      crew.delete(crewId)
    }

    if (crew.size === 0) {
      params.delete('crew')
    } else {
      params.set('crew', Array.from(crew).join(','))
    }
    router.push(`?${params.toString()}`)
  }, [searchParams, activeCrew, router])

  return (
    <div className="w-64 border-l bg-white p-4 hidden md:flex flex-col space-y-6 overflow-y-auto">
      <div>
        <h3 className="font-semibold text-sm mb-3">Manage View</h3>
        <div className="space-y-2 text-sm text-slate-700">
          <label className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              checked={activeTypes.includes('jobs')}
              onChange={(e) => setType('jobs', e.target.checked)}
              className="text-blue-600 rounded" 
            />
            <span>Jobs</span>
          </label>
          <label className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              checked={activeTypes.includes('tasks')}
              onChange={(e) => setType('tasks', e.target.checked)}
              className="text-blue-600 rounded" 
            />
            <span>Tasks</span>
          </label>
          <label className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              checked={activeTypes.includes('appointments')}
              onChange={(e) => setType('appointments', e.target.checked)}
              className="text-blue-600 rounded" 
            />
            <span>Appointments</span>
          </label>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-3">Assigned Crew</h3>
        <div className="space-y-2 text-sm text-slate-700">
           {staff.map(member => (
             <label key={member.id} className="flex items-center space-x-2">
               <input 
                 type="checkbox" 
                 checked={activeCrew.length === 0 || activeCrew.includes(member.id)}
                 onChange={(e) => {
                   if (activeCrew.length === 0 && !e.target.checked) {
                     // If all were selected (length 0), and we uncheck one, we need to explicitly check all OTHERS
                     const others = staff.filter(s => s.id !== member.id).map(s => s.id)
                     const params = new URLSearchParams(searchParams.toString())
                     params.set('crew', others.join(','))
                     router.push(`?${params.toString()}`)
                   } else {
                     setCrew(member.id, e.target.checked)
                   }
                 }}
                 className="text-blue-600 rounded" 
               />
               <span>{member.full_name}</span>
             </label>
           ))}
        </div>
      </div>
    </div>
  )
}
