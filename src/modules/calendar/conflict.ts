import { CalendarEvent } from './server/repository'

export function computeConflicts(timedEvents: CalendarEvent[]) {
  return timedEvents.map(event => {
    let hasConflict = false
    if (event.type === 'appointment' && event.assigned_to && event.assigned_to.length > 0) {
      // check overlap with jobs
      const start = new Date(event.start_time).getTime()
      const end = event.end_time ? new Date(event.end_time).getTime() : start + 3600000
      
      hasConflict = timedEvents.some(other => {
        if (other.type === 'job' && other.assigned_to && other.assigned_to.length > 0) {
          const otherStart = new Date(other.start_time).getTime()
          const otherEnd = other.end_time ? new Date(other.end_time).getTime() : otherStart + 3600000
          
          const overlapsTime = start < otherEnd && end > otherStart
          const overlapsPerson = event.assigned_to!.some(u => other.assigned_to!.includes(u))
          
          return overlapsTime && overlapsPerson
        }
        return false
      })
    }
    return { ...event, hasConflict }
  })
}
