import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSchedulingBoardData } from '@/modules/scheduling/server/repository'
import { getUnifiedCalendarData } from '@/modules/calendar/server/repository'
import { SchedulingBoard } from './components/scheduling-board'
import { UnifiedCalendar } from './components/unified-calendar'
import { UnifiedListView } from './components/unified-list-view'
import { CalendarSidebar } from './components/calendar-sidebar'
import { format, parseISO, isValid, startOfWeek, endOfWeek } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function SchedulingPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string, view?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const tenantId = user.app_metadata.tenant_id
  if (!tenantId) return redirect('/login')

  const resolvedParams = await searchParams
  let dateStr = resolvedParams.date
  if (!dateStr || !isValid(parseISO(dateStr))) {
    dateStr = format(new Date(), 'yyyy-MM-dd')
  }
  const view = resolvedParams.view || 'calendar'

  const dateObj = parseISO(dateStr)
  // Compute week range (assuming Monday start)
  const weekStart = format(startOfWeek(dateObj, { weekStartsOn: 1 }), "yyyy-MM-dd'T'00:00:00'Z'")
  const weekEnd = format(endOfWeek(dateObj, { weekStartsOn: 1 }), "yyyy-MM-dd'T'23:59:59'Z'")

  const { getTenantStaff } = await import('@/modules/users/server/repository')
  const { getContacts } = await import('@/modules/clients/server/repository')

  // Fetch both board data (for legacy) and unified data (for new tabs)
  const [boardRes, calendarRes, staffRes, contactsRes] = await Promise.all([
    getSchedulingBoardData(supabase, tenantId, dateStr),
    getUnifiedCalendarData(supabase, tenantId, weekStart, weekEnd),
    getTenantStaff(supabase, tenantId),
    getContacts(supabase, tenantId)
  ])

  if (!boardRes.success || !boardRes.data || calendarRes.error) {
    return <div className="p-8 text-red-500">Error loading scheduling data</div>
  }

  const staff = staffRes.data || []
  const contacts = contactsRes.data || []

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <Tabs defaultValue={view} className="flex-1 flex flex-col p-4 space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="dispatch">Dispatch Board</TabsTrigger>
            </TabsList>
            <div className="text-sm font-medium text-slate-600">
              {format(parseISO(weekStart.split('T')[0]), 'MMM d')} - {format(parseISO(weekEnd.split('T')[0]), 'MMM d, yyyy')}
            </div>
          </div>
          
          <TabsContent value="calendar" className="flex-1 min-h-0 border bg-white rounded-md overflow-auto">
            <UnifiedCalendar 
              events={calendarRes.data} 
              currentDate={dateObj} 
              tenantId={tenantId} 
              tenantStaff={staff}
              contacts={contacts}
              vehicles={boardRes.data.vehicles}
            />
          </TabsContent>
          <TabsContent value="list" className="flex-1 min-h-0 border bg-white rounded-md p-4 overflow-auto">
            <UnifiedListView events={calendarRes.data} tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="dispatch" className="flex-1 min-h-0 h-full">
            <SchedulingBoard
              date={dateStr}
              vehicles={boardRes.data.vehicles}
              crew={boardRes.data.crew}
              jobs={boardRes.data.jobs as any}
            />
          </TabsContent>
        </Tabs>
      </div>
      <CalendarSidebar />
    </div>
  )
}
