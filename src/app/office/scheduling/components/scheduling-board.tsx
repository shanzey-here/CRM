'use client'

import { useState } from 'react'
import { format, addDays, subDays, parseISO, addHours } from 'date-fns'
import { useRouter } from 'next/navigation'
import { DndContext, useDroppable, useDraggable, DragEndEvent, DragOverlay } from '@dnd-kit/core'
import { assignCrewAction, assignVehicleAction } from '../actions'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Truck, UserCircle, Calendar as CalendarIcon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
type Job = any // Using any for brevity in UI mapping, from getSchedulingBoardData
type Vehicle = any
type Crew = any

// Constants
const START_HOUR = 7
const END_HOUR = 19
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

function calculateDurationHours(volume: number | null | undefined) {
  if (!volume) return 2 // Default 2 hours if unknown
  return Math.ceil(1 + (volume / 250))
}

export function SchedulingBoard({ date, vehicles, crew, jobs }: { date: string, vehicles: Vehicle[], crew: Crew[], jobs: Job[] }) {
  const router = useRouter()
  const [errorToast, setErrorToast] = useState<string | null>(null)
  
  // Local state for optimistic updates
  const [localCrewAssignments, setLocalCrewAssignments] = useState(jobs.flatMap(j => j.job_crew_assignments || []))
  const [localVehicleAssignments, setLocalVehicleAssignments] = useState(jobs.flatMap(j => j.job_vehicle_assignments || []))

  const [activeId, setActiveId] = useState<string | null>(null)

  // Derived unassigned pool
  const unassignedJobs = jobs.filter(job => {
    const hasCrew = localCrewAssignments.some(ca => ca.job_id === job.id)
    const hasVehicle = localVehicleAssignments.some(va => va.job_id === job.id)
    return !hasCrew || !hasVehicle
  })

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const jobId = active.id as string
    const [resourceType, resourceId, hourStr] = (over.id as string).split('|')
    const hour = parseInt(hourStr, 10)

    const job = jobs.find(j => j.id === jobId)
    if (!job) return

    const duration = calculateDurationHours(job.quote?.total_volume)
    
    // Create ISO timestamps
    const startDate = parseISO(date)
    startDate.setHours(hour, 0, 0, 0)
    const endDate = new Date(startDate)
    endDate.setHours(hour + duration)

    const startISO = startDate.toISOString()
    const endISO = endDate.toISOString()

    // Optimistic Update
    const tempId = 'temp-' + Date.now()
    if (resourceType === 'crew') {
      const newAssignment = { id: tempId, job_id: jobId, user_id: resourceId, scheduled_start: startISO, scheduled_end: endISO, job }
      setLocalCrewAssignments(prev => [...prev, newAssignment])
      
      const res = await assignCrewAction(jobId, resourceId, startISO, endISO)
      if (!res.success) {
        setLocalCrewAssignments(prev => prev.filter(a => a.id !== tempId))
        setErrorToast(res.error || 'Failed to assign crew')
        setTimeout(() => setErrorToast(null), 4000)
      } else {
        router.refresh()
      }
    } else if (resourceType === 'vehicle') {
      const newAssignment = { id: tempId, job_id: jobId, vehicle_id: resourceId, scheduled_start: startISO, scheduled_end: endISO, job }
      setLocalVehicleAssignments(prev => [...prev, newAssignment])

      const res = await assignVehicleAction(jobId, resourceId, startISO, endISO)
      if (!res.success) {
        setLocalVehicleAssignments(prev => prev.filter(a => a.id !== tempId))
        setErrorToast(res.error || 'Failed to assign vehicle')
        setTimeout(() => setErrorToast(null), 4000)
      } else {
        router.refresh()
      }
    }
  }

  const navigateDay = (days: number) => {
    const newDate = format(addDays(parseISO(date), days), 'yyyy-MM-dd')
    router.push(`/office/scheduling?date=${newDate}`)
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <header className="flex flex-none items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">Dispatch Calendar</h1>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateDay(-1)}
            title="Previous day"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 font-medium text-lg min-w-[160px] justify-center">
            <CalendarIcon className="h-5 w-5 text-slate-500" />
            {format(parseISO(date), 'MMM do, yyyy')}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateDay(1)}
            title="Next day"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Error Toast */}
      {errorToast && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white border-2 border-red-500 text-red-700 px-4 py-3 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">{errorToast}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <DndContext id="scheduling-dispatch-board" onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          
          {/* Left Panel: Unassigned Jobs */}
          <div className="w-80 flex-none border-r bg-slate-50 flex flex-col">
            <div className="p-4 border-b bg-white">
              <h2 className="font-semibold text-slate-700">Jobs Pool</h2>
              <p className="text-sm text-slate-500">{unassignedJobs.length} require assignment</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {unassignedJobs.map(job => {
                const hasCrew = localCrewAssignments.some(ca => ca.job_id === job.id)
                const hasVehicle = localVehicleAssignments.some(va => va.job_id === job.id)
                return (
                  <DraggableJobCard 
                    key={job.id} 
                    job={job} 
                    hasCrew={hasCrew} 
                    hasVehicle={hasVehicle} 
                  />
                )
              })}
            </div>
          </div>

          {/* Right Panel: Timeline Grid */}
          <div className="flex-1 overflow-x-auto overflow-y-auto bg-white relative">
            <div className="min-w-[1200px]">
              
              {/* Timeline Header (Hours) */}
              <div className="flex border-b sticky top-0 bg-white z-20">
                <div className="w-48 flex-none border-r p-4 font-medium text-slate-500 bg-slate-50">Resource</div>
                <div className="flex flex-1">
                  {HOURS.map(hour => (
                    <div key={hour} className="flex-1 border-r p-2 text-sm text-slate-400 text-center">
                      {hour}:00
                    </div>
                  ))}
                </div>
              </div>

              {/* Vehicles Section */}
              <div className="bg-slate-100/50 p-2 font-semibold text-slate-700 text-sm border-b uppercase tracking-wider flex items-center gap-2">
                <Truck className="h-4 w-4" /> Vehicles
              </div>
              {vehicles.map(vehicle => (
                <ResourceRow 
                  key={vehicle.id} 
                  resource={vehicle} 
                  type="vehicle" 
                  date={date}
                  assignments={localVehicleAssignments.filter(a => a.vehicle_id === vehicle.id)}
                  jobs={jobs}
                />
              ))}

              {/* Crews Section */}
              <div className="bg-slate-100/50 p-2 font-semibold text-slate-700 text-sm border-b border-t uppercase tracking-wider flex items-center gap-2">
                <UserCircle className="h-4 w-4" /> Crew Members
              </div>
              {crew.map(member => (
                <ResourceRow 
                  key={member.id} 
                  resource={member} 
                  type="crew" 
                  date={date}
                  assignments={localCrewAssignments.filter(a => a.user_id === member.id)}
                  jobs={jobs}
                />
              ))}

            </div>
          </div>

          {/* Render Drag Overlay to prevent clipping */}
          <DragOverlay>
            {activeId ? (
              <DraggableJobCard 
                job={jobs.find(j => j.id === activeId)!} 
                hasCrew={false} 
                hasVehicle={false}
                isOverlay
              />
            ) : null}
          </DragOverlay>
          
        </DndContext>
      </div>
    </div>
  )
}

function DraggableJobCard({ job, hasCrew, hasVehicle, isOverlay }: { job: Job, hasCrew: boolean, hasVehicle: boolean, isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { job }
  })

  // If we are currently dragging THIS item, and this component instance is the ORIGINAL one in the sidebar,
  // we want to hide it (or make it faint) because the DragOverlay is rendering the moving copy.
  if (isDragging && !isOverlay) {
    return <div className="bg-slate-100 p-3 rounded-md border border-dashed border-slate-300 h-[88px] opacity-50" />
  }

  const duration = calculateDurationHours(job.quote?.total_volume)

  return (
    <div 
      ref={setNodeRef} 
      {...listeners} 
      {...attributes}
      className={cn(
        "bg-white p-3 rounded-md border shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 transition-colors w-full",
        isOverlay && "opacity-90 shadow-xl ring-2 ring-blue-500 cursor-grabbing rotate-2"
      )}
    >
      <div className="font-medium text-slate-900 truncate">
        {job.contact?.first_name} {job.contact?.last_name}
      </div>
      <div className="text-xs text-slate-500 mt-1 flex justify-between">
        <span>{job.quote?.total_volume || 0} cuft</span>
        <span>~{duration} hrs</span>
      </div>
      <div className="mt-2 flex gap-1 flex-wrap">
        {!hasCrew && <span className="text-[10px] border border-red-300 text-red-700 bg-white px-1.5 py-0.5 rounded font-medium">Needs Crew</span>}
        {!hasVehicle && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Needs Vehicle</span>}
      </div>
    </div>
  )
}

function ResourceRow({ resource, type, date, assignments, jobs }: { resource: any, type: 'crew' | 'vehicle', date: string, assignments: any[], jobs: Job[] }) {
  return (
    <div className="flex border-b relative group h-16">
      {/* Resource Label */}
      <div className="w-48 flex-none border-r p-3 bg-white flex flex-col justify-center sticky left-0 z-10">
        <div className="font-medium text-sm text-slate-900 truncate">
          {type === 'vehicle' ? resource.name : resource.full_name}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {type === 'vehicle' ? `${resource.type} (${resource.capacity_cubic} cf)` : resource.role}
        </div>
      </div>

      {/* Grid Cells */}
      <div className="flex flex-1 relative bg-slate-50/50">
        {HOURS.map(hour => (
          <DroppableCell key={hour} id={`${type}|${resource.id}|${hour}`} />
        ))}

        {/* Render Assignments as Absolute blocks over the grid */}
        {assignments.map(assignment => {
          const start = parseISO(assignment.scheduled_start)
          const end = parseISO(assignment.scheduled_end)
          
          // Calculate visual positioning
          const startHour = start.getHours() + (start.getMinutes() / 60)
          const endHour = end.getHours() + (end.getMinutes() / 60)
          
          // Constrain to visible timeline bounds
          const visualStart = Math.max(START_HOUR, startHour)
          const visualEnd = Math.min(END_HOUR, endHour)
          const duration = visualEnd - visualStart

          if (duration <= 0) return null

          const leftPercent = ((visualStart - START_HOUR) / (END_HOUR - START_HOUR)) * 100
          const widthPercent = (duration / (END_HOUR - START_HOUR)) * 100

          const assignedJob = jobs.find(j => j.id === assignment.job_id)

          return (
            <div
              key={assignment.id}
              className="absolute top-1 bottom-1 rounded border shadow-sm overflow-hidden text-xs flex flex-col p-1"
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                backgroundColor: type === 'vehicle' ? '#eff6ff' : '#dbeafe',
                borderColor: type === 'vehicle' ? '#bfdbfe' : '#93c5fd',
                color: '#1e3a8a',
              }}
            >
              <div className="font-semibold truncate">
                {assignedJob?.contact?.first_name} {assignedJob?.contact?.last_name}
              </div>
              <div className="truncate opacity-80">
                {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DroppableCell({ id }: { id: string }) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 border-r transition-colors",
        isOver && "bg-blue-100/50 outline outline-2 outline-blue-400 outline-offset-[-2px]"
      )}
    />
  )
}
