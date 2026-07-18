import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSchedulingBoardData } from '@/modules/scheduling/server/repository'
import { SchedulingBoard } from './components/scheduling-board'
import { format, parseISO, isValid } from 'date-fns'

export default async function SchedulingPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const tenantId = user.app_metadata.tenant_id
  if (!tenantId) return redirect('/login')

  // Parse date from searchParams, default to today
  const resolvedParams = await searchParams
  let dateStr = resolvedParams.date
  if (!dateStr || !isValid(parseISO(dateStr))) {
    dateStr = format(new Date(), 'yyyy-MM-dd')
  }

  const { success, data, error } = await getSchedulingBoardData(supabase, tenantId, dateStr)
  if (!success || !data) {
    return <div className="p-8 text-red-500">Error loading scheduling data: {error}</div>
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 min-h-0">
        <SchedulingBoard
          date={dateStr}
          vehicles={data.vehicles}
          crew={data.crew}
          jobs={data.jobs as any}
        />
      </div>
    </div>
  )
}
