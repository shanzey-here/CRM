'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarEvent } from '@/modules/calendar/server/repository'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateCalendarEventStatus } from '@/modules/calendar/server/actions'
import { Calendar, Clock, MapPin, User, FileText, CheckCircle2 } from 'lucide-react'

const STATUS_OPTIONS = {
  job: ['scheduled', 'in_progress', 'completed', 'cancelled'],
  task: ['pending', 'in_progress', 'completed', 'cancelled'],
  appointment: ['scheduled', 'completed', 'cancelled']
}

export function UnifiedDetailModal({
  event,
  isOpen,
  onClose,
  tenantStaff,
  contacts
}: {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  tenantStaff: any[]
  contacts: any[]
}) {
  const [status, setStatus] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (event) {
      setStatus(event.status)
    }
  }, [event])

  if (!event) return null

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus)
    setIsUpdating(true)
    const res = await updateCalendarEventStatus(event.id, event.type, newStatus)
    setIsUpdating(false)
    if (!res.success) {
      console.error(`Failed to update status: ${res.error}`)
      setStatus(event.status) // revert
    }
  }

  const assignedNames = event.assigned_to 
    ? event.assigned_to.map(id => tenantStaff.find(s => s.id === id)?.full_name || 'Unknown').join(', ')
    : 'None'

  const contactName = event.contact_id
    ? contacts.find(c => c.id === event.contact_id)?.full_name || 'Unknown Contact'
    : null

  const options = STATUS_OPTIONS[event.type] || []

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <span className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-sm ${
              event.type === 'job' ? 'bg-blue-100 text-blue-800' :
              event.type === 'task' ? 'bg-amber-100 text-amber-800' :
              'bg-purple-100 text-purple-800'
            }`}>
              {event.type}
            </span>
          </div>
          <DialogTitle className="text-xl">{event.title}</DialogTitle>
          <DialogDescription>
            {contactName && (
              <span className="flex items-center text-slate-700 mt-2">
                <User className="w-4 h-4 mr-2 text-slate-400" />
                {contactName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex flex-col space-y-1">
              <span className="text-slate-500 flex items-center"><Calendar className="w-3.5 h-3.5 mr-1"/> Date</span>
              <span className="font-medium">{format(parseISO(event.start_time), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex flex-col space-y-1">
              <span className="text-slate-500 flex items-center"><Clock className="w-3.5 h-3.5 mr-1"/> Time</span>
              <span className="font-medium">
                {event.all_day ? 'All Day' : (
                  `${format(parseISO(event.start_time), 'h:mm a')} ${event.end_time ? `- ${format(parseISO(event.end_time), 'h:mm a')}` : ''}`
                )}
              </span>
            </div>
            <div className="flex flex-col space-y-1 col-span-2">
              <span className="text-slate-500 flex items-center"><User className="w-3.5 h-3.5 mr-1"/> Assigned To</span>
              <span className="font-medium">{assignedNames}</span>
            </div>
            
            {event.type === 'job' && event.raw_data && (
              <>
                <div className="flex flex-col space-y-1 col-span-2">
                  <span className="text-slate-500 flex items-center"><MapPin className="w-3.5 h-3.5 mr-1"/> Pickup</span>
                  <span className="font-medium">{event.raw_data.pickup_address?.full_address || 'Not specified'}</span>
                </div>
                <div className="flex flex-col space-y-1 col-span-2">
                  <span className="text-slate-500 flex items-center"><MapPin className="w-3.5 h-3.5 mr-1"/> Dropoff</span>
                  <span className="font-medium">{event.raw_data.dropoff_address?.full_address || 'Not specified'}</span>
                </div>
              </>
            )}

            {event.type === 'task' && event.raw_data?.description && (
              <div className="flex flex-col space-y-1 col-span-2">
                <span className="text-slate-500 flex items-center"><FileText className="w-3.5 h-3.5 mr-1"/> Description</span>
                <span className="font-medium whitespace-pre-wrap">{event.raw_data.description}</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2 text-slate-400" />
              Status
            </span>
            <Select 
              value={status} 
              onValueChange={handleStatusChange}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {options.map(opt => (
                  <SelectItem key={opt} value={opt}>
                    {opt.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
