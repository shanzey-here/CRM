import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSchedulingBoardData } from '@/modules/scheduling/server/repository'
import { getUnifiedCalendarData } from '@/modules/calendar/server/repository'
import { SchedulingBoard } from './components/scheduling-board'
import { UnifiedCalendar } from './components/unified-calendar'
import { UnifiedListView } from './components/unified-list-view'
import { CalendarSidebar } from './components/calendar-sidebar'
import { DateNavigator } from './components/date-navigator'
import { format, parseISO, isValid, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function SchedulingPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string, view?: string, range?: string, type?: string, crew?: string }>
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
  const range = (resolvedParams.range === 'day') ? 'day' : 'week'
  const activeTypes = resolvedParams.type ? resolvedParams.type.split(',') : ['jobs', 'tasks', 'appointments']
  const activeCrew = resolvedParams.crew ? resolvedParams.crew.split(',') : []

  const dateObj = parseISO(dateStr)
  let periodStart = ''
  let periodEnd = ''

  if (range === 'week') {
    periodStart = format(startOfWeek(dateObj, { weekStartsOn: 1 }), "yyyy-MM-dd'T'00:00:00'Z'")
    periodEnd = format(endOfWeek(dateObj, { weekStartsOn: 1 }), "yyyy-MM-dd'T'23:59:59'Z'")
  } else {
    periodStart = format(dateObj, "yyyy-MM-dd'T'00:00:00'Z'")
    periodEnd = format(dateObj, "yyyy-MM-dd'T'23:59:59'Z'")
  }

  const { getTenantStaff } = await import('@/modules/users/server/repository')
  const { getContacts } = await import('@/modules/clients/server/repository')

  // Fetch both board data (for legacy) and unified data (for new tabs)
  const [boardRes, calendarRes, staffRes, contactsRes] = await Promise.all([
    getSchedulingBoardData(supabase, tenantId, dateStr),
    getUnifiedCalendarData(supabase, tenantId, periodStart, periodEnd),
    getTenantStaff(supabase, tenantId),
    getContacts(supabase, tenantId)
  ])

  if (!boardRes.success || !boardRes.data || calendarRes.error) {
    return <div className="p-8 text-red-500">Error loading scheduling data</div>
  }

  const staff = staffRes.data || []
  const contacts = contactsRes.data || []
  let events = calendarRes.data || []

  if (activeTypes.length === 0 || resolvedParams.type === 'none') {
    events = []
  } else {
    events = events.filter(e => {
      let matchesType = activeTypes.includes(e.type + 's')
      let matchesCrew = true
      if (activeCrew.length > 0) {
        if (!e.assigned_to || e.assigned_to.length === 0) {
          matchesCrew = false
        } else {
          matchesCrew = e.assigned_to.some(uId => activeCrew.includes(uId))
        }
      }
      return matchesType && matchesCrew
    })
  }

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
            
            {view !== 'dispatch' && (
              <DateNavigator currentDate={dateStr} range={range} />
            )}
          </div>
          
          <TabsContent value="calendar" className="flex-1 min-h-0 border bg-white rounded-md overflow-auto">
            <UnifiedCalendar 
              events={events} 
              currentDate={dateObj} 
              range={range}
              tenantId={tenantId} 
              tenantStaff={staff}
              contacts={contacts}
              vehicles={boardRes.data.vehicles}
            />
          </TabsContent>
          <TabsContent value="list" className="flex-1 min-h-0 border bg-white rounded-md p-4 overflow-auto">
            <UnifiedListView events={events} tenantId={tenantId} />
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
      <CalendarSidebar staff={staff} />
    </div>
  )
}

