'use client'

import { useMemo, useState } from 'react'
import { CalendarEvent } from '@/modules/calendar/server/repository'
import { format, addDays, startOfWeek, isSameDay, getHours, getMinutes, parseISO } from 'date-fns'
import { AlertCircle } from 'lucide-react'
import { UnifiedDetailModal } from './unified-detail-modal'
import { UnifiedCreationModal } from './unified-creation-modal'
import { computeConflicts } from '@/modules/calendar/conflict'

export function UnifiedCalendar({ 
  events, 
  currentDate, 
  range = 'week',
  tenantId,
  tenantStaff,
  contacts,
  vehicles
}: { 
  events: CalendarEvent[], 
  currentDate: Date, 
  range?: 'week' | 'day',
  tenantId: string,
  tenantStaff: any[],
  contacts: any[],
  vehicles: any[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date, hour?: number } | null>(null)
  
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const days = range === 'week' 
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), i))
    : [currentDate]

  const hours = Array.from({ length: 14 }, (_, i) => i + 7) // 7am to 8pm

  // Separate all-day (tasks) and timed (jobs, appts)
  const allDayEvents = events.filter(e => e.all_day)
  const timedEvents = events.filter(e => !e.all_day)

  // Compute conflicts for appointments using the extracted logic
  const eventsWithConflicts = useMemo(() => {
    return computeConflicts(timedEvents)
  }, [timedEvents])

  const handleSlotClick = (date: Date, hour?: number) => {
    setSelectedSlot({ date, hour })
    setModalOpen(true)
  }

  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation() // Prevent slot click
    setSelectedEvent(event)
    setDetailModalOpen(true)
  }

  const gridColsClass = days.length === 1 ? 'grid-cols-2' : 'grid-cols-8'

  return (
    <div className="flex flex-col h-full bg-white text-sm relative">
      {/* Header */}
      <div className={`grid ${gridColsClass} border-b border-slate-200`}>
        <div className="w-16 border-r border-slate-200 p-2 text-center text-slate-500 font-medium shrink-0">Time</div>
        {days.map(day => (
          <div key={day.toISOString()} className="border-r border-slate-200 p-2 text-center">
            <div className="font-medium text-slate-900">{format(day, 'EEE')}</div>
            <div className="text-slate-500">{format(day, 'd')}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* All day section */}
        <div className={`grid ${gridColsClass} border-b border-slate-200 bg-slate-50 relative z-10`}>
          <div className="w-16 border-r border-slate-200 p-2 text-xs text-slate-500 flex items-center justify-center shrink-0">All Day</div>
          {days.map(day => (
            <div key={`allday-${day.toISOString()}`} className="border-r border-slate-200 p-1 min-h-[40px] relative">
              {allDayEvents.filter(e => isSameDay(parseISO(e.start_time), day)).map(e => (
                <div 
                  key={e.id} 
                  onClick={(event) => handleEventClick(event, e)}
                  className={`bg-slate-200 text-slate-800 border-slate-300 border rounded px-2 py-1 mb-1 text-xs truncate cursor-pointer hover:bg-slate-300 ${e.status === 'completed' ? 'line-through opacity-60' : ''}`}
                >
                  {e.title}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Timed grid */}
        <div className="relative min-w-[600px]" style={{ height: hours.length * 60 }}>
          <div className={`absolute inset-0 grid ${gridColsClass}`}>
            <div className="w-16 border-r border-slate-200 shrink-0">
              {hours.map(hour => (
                <div key={hour} className="h-[60px] border-b border-slate-100 flex justify-end pr-2 py-1">
                  <span className="text-xs text-slate-500 relative -top-3">{hour}:00</span>
                </div>
              ))}
            </div>
            {days.map(day => (
              <div key={`grid-${day.toISOString()}`} className="border-r border-slate-200 relative">
                {hours.map(hour => (
                  <div 
                    key={hour} 
                    className="h-[60px] border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleSlotClick(day, hour)}
                  />
                ))}
                {/* Render events for this day */}
                {eventsWithConflicts.filter(e => isSameDay(parseISO(e.start_time), day)).map(e => {
                  const start = parseISO(e.start_time)
                  const end = e.end_time ? parseISO(e.end_time) : new Date(start.getTime() + 3600000)
                  const startMinutes = getHours(start) * 60 + getMinutes(start) - (7 * 60)
                  const endMinutes = getHours(end) * 60 + getMinutes(end) - (7 * 60)
                  const duration = Math.max(endMinutes - startMinutes, 30)

                  const top = Math.max(0, startMinutes) // Don't render above 7am
                  const height = duration

                  const colorClass = e.type === 'job' 
                    ? 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200' 
                    : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200'
                  
                  const conflictClass = e.hasConflict ? 'ring-2 ring-red-500 border-red-500 z-10 shadow-sm' : ''

                  return (
                    <div 
                      key={e.id}
                      onClick={(event) => handleEventClick(event, e)}
                      className={`absolute left-1 right-1 border rounded px-2 py-1 overflow-hidden cursor-pointer flex flex-col transition-colors ${colorClass} ${conflictClass} ${e.status === 'completed' ? 'opacity-60 line-through' : ''}`}
                      style={{ top: `${top}px`, height: `${height}px` }}
                      title={e.title}
                    >
                      <div className="font-semibold text-xs flex justify-between">
                        <span className="truncate">{e.title}</span>
                        {e.hasConflict && <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 ml-1 bg-white rounded-full" />}
                      </div>
                      <div className="text-[10px] opacity-80 truncate mt-0.5">
                        {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <UnifiedCreationModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        initialSlot={selectedSlot} 
        tenantId={tenantId}
        tenantStaff={tenantStaff}
        contacts={contacts}
        vehicles={vehicles}
      />

      <UnifiedDetailModal
        event={selectedEvent}
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedEvent(null); }}
        tenantStaff={tenantStaff}
        contacts={contacts}
      />
    </div>
  )
}
