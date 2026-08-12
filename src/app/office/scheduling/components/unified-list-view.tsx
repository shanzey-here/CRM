'use client'

import { CalendarEvent } from '@/modules/calendar/server/repository'
import { format, parseISO } from 'date-fns'

export function UnifiedListView({ events, tenantId }: { events: CalendarEvent[], tenantId: string }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 bg-slate-50 border-b sticky top-0">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Time / Due Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No upcoming items found
                </td>
              </tr>
            ) : events.map(e => (
              <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                    ${e.type === 'job' ? 'bg-blue-100 text-blue-800' : ''}
                    ${e.type === 'task' ? 'bg-slate-100 text-slate-800' : ''}
                    ${e.type === 'appointment' ? 'bg-amber-100 text-amber-800' : ''}
                  `}>
                    {e.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{e.title}</td>
                <td className="px-4 py-3 text-slate-600">
                  {e.all_day ? format(parseISO(e.start_time), 'MMM d, yyyy') : (
                    <>
                      {format(parseISO(e.start_time), 'MMM d, h:mm a')}
                      {e.end_time && ` - ${format(parseISO(e.end_time), 'h:mm a')}`}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 capitalize">
                  {e.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
