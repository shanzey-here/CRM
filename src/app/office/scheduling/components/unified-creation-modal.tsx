'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createAppointmentAction } from '@/modules/appointments/server/actions'
import { AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { ManualJobForm } from '../../jobs/components/manual-job-form'
import { CreateTaskForm } from '../../components/create-task-form'

export function UnifiedCreationModal({ 
  isOpen, 
  onClose, 
  initialSlot,
  tenantId,
  tenantStaff,
  contacts,
  vehicles
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  initialSlot: { date: Date, hour?: number } | null,
  tenantId: string,
  tenantStaff: any[],
  contacts: any[],
  vehicles: any[]
}) {
  const [type, setType] = useState<'job' | 'task' | 'appointment'>('appointment')
  const [conflictWarning, setConflictWarning] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCreateAppointment = async (ignoreConflict: boolean = false) => {
    setLoading(true)
    setConflictWarning(false)

    // Dummy payload for UI demonstration. In a real form, these would be bound to inputs.
    const start_time = initialSlot 
      ? new Date(initialSlot.date.setHours(initialSlot.hour || 9, 0, 0, 0)).toISOString()
      : new Date().toISOString()
      
    const end_time = initialSlot
      ? new Date(initialSlot.date.setHours((initialSlot.hour || 9) + 1, 0, 0, 0)).toISOString()
      : new Date(Date.now() + 3600000).toISOString()

    const payload = {
      title: 'New Appointment',
      start_time,
      end_time,
      assigned_to: null, // Assuming we have a user selected
      ignore_conflict: ignoreConflict
    }

    try {
      const res = await createAppointmentAction(payload)
      if (!res.success && res.error === 'DOUBLE_BOOKING_CONFLICT') {
        setConflictWarning(true)
      } else if (res.success) {
        onClose()
      } else {
        alert(res.error)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-right text-sm font-medium">Type</span>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="job">Job</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="appointment">Appointment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded p-4 text-sm bg-slate-50 relative max-h-[60vh] overflow-y-auto">
            {type === 'job' && (
              <ManualJobForm 
                contacts={contacts}
                tenantStaff={tenantStaff}
                vehicles={vehicles}
                initialSlot={initialSlot}
                onSuccess={onClose}
              />
            )}
            {type === 'task' && (
              <CreateTaskForm
                tenantStaff={tenantStaff}
                onSuccess={onClose}
              />
            )}
            {type === 'appointment' && (
              <div className="text-left space-y-4">
                 <div>
                    <label className="block text-xs font-medium mb-1">Time Slot</label>
                    <div className="px-3 py-2 border rounded bg-white">
                      {initialSlot ? format(initialSlot.date, 'MMM d, yyyy') + (initialSlot.hour !== undefined ? ` at ${initialSlot.hour}:00` : '') : 'Select time'}
                    </div>
                 </div>
                 {conflictWarning && (
                   <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium">Double Booking Conflict</div>
                        <div className="text-xs mt-1">This user is already booked for a Job during this time. Are you sure you want to proceed?</div>
                        <div className="mt-2 flex space-x-2">
                           <Button size="sm" variant="destructive" onClick={() => handleCreateAppointment(true)} disabled={loading}>
                             Save Anyway
                           </Button>
                           <Button size="sm" variant="outline" onClick={() => setConflictWarning(false)}>
                             Cancel
                           </Button>
                        </div>
                      </div>
                   </div>
                 )}
                 {!conflictWarning && (
                   <Button onClick={() => handleCreateAppointment(false)} disabled={loading} className="w-full">
                     Save Appointment
                   </Button>
                 )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
