import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getJobDetails } from '@/modules/jobs/server/repository'
import { getJobAssignments } from '@/modules/scheduling/server/repository'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, MapPin, Phone, Mail, User, Printer, Truck, Users } from 'lucide-react'
import { EditJobForm } from './components/edit-job-form'
import { EditActualTimesForm } from './components/edit-actual-times-form'

export const dynamic = 'force-dynamic'

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const supabase = await createClient()

  // 1. Authenticate and enforce Tenant Context
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }
  const tenantId = user.app_metadata.tenant_id

  // 2. Fetch Job Details and Assignments
  const [{ success, jobDetails, error }, assignmentsRes] = await Promise.all([
    getJobDetails(supabase, tenantId, id),
    getJobAssignments(supabase, tenantId, id)
  ])

  if (!success || !jobDetails) {
    notFound()
  }

  const job = jobDetails as any
  const contact = job.contact
  const origin = job.origin_address
  const dest = job.destination_address
  const quoteData = job.quote
  const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData
  const crewAssignments = assignmentsRes.success ? assignmentsRes.crewAssignments : []
  const vehicleAssignments = assignmentsRes.success ? assignmentsRes.vehicleAssignments : []

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/office/jobs" className="text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Job: {contact?.first_name} {contact?.last_name || ''}
            </h1>
            <Badge variant="secondary" className="uppercase text-xs tracking-wider">
              {job.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-slate-500 mt-1">
            Scheduled for: {job.move_date ? format(new Date(job.move_date), 'EEEE, MMMM do, yyyy') : 'TBD'}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <EditJobForm
            jobId={job.id}
            internalNotes={job.internal_notes ?? null}
            customerNotes={job.customer_notes ?? null}
          />
          <Link
            href={`/print/jobs/${job.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 bg-emerald-600 text-white shadow hover:bg-emerald-700 h-9 px-4 py-2"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Job Sheet
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 text-slate-700">
              <User className="h-4 w-4 text-slate-400" />
              <span>{contact?.first_name} {contact?.last_name}</span>
            </div>
            {contact?.phone && (
              <div className="flex items-center gap-3 text-slate-700">
                <Phone className="h-4 w-4 text-slate-400" />
                <a href={`tel:${contact.phone}`} className="hover:text-emerald-600">{contact.phone}</a>
              </div>
            )}
            {contact?.email && (
              <div className="flex items-center gap-3 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400" />
                <a href={`mailto:${contact.email}`} className="hover:text-emerald-600">{contact.email}</a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Move Details (Quote Snapshot) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Move Details</CardTitle>
            <CardDescription>From approved quote</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-slate-500">Estimated Volume</span>
              <span className="font-medium">{quote?.total_volume || 0} cu ft</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-slate-500">Total Price</span>
              <span className="font-medium">${quote?.total_price?.toLocaleString() || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Deposit Paid</span>
              <span className="font-medium text-emerald-600">${quote?.deposit_amount?.toLocaleString() || '0.00'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Locations */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Locations</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" /> Origin
              </h3>
              {origin ? (
                <div className="text-slate-700 text-sm space-y-1 bg-slate-50 p-4 rounded-md">
                  <p>{origin.street_1}</p>
                  {origin.street_2 && <p>{origin.street_2}</p>}
                  <p>{origin.city}, {origin.state} {origin.postal_code}</p>
                  <p className="mt-2 text-slate-500">Access: {origin.access_notes || 'None specified'}</p>
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic">No origin address provided.</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" /> Destination
              </h3>
              {dest ? (
                <div className="text-slate-700 text-sm space-y-1 bg-slate-50 p-4 rounded-md">
                  <p>{dest.street_1}</p>
                  {dest.street_2 && <p>{dest.street_2}</p>}
                  <p>{dest.city}, {dest.state} {dest.postal_code}</p>
                  <p className="mt-2 text-slate-500">Access: {dest.access_notes || 'None specified'}</p>
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic">No destination address provided.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Special Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Special Instructions</CardTitle>
            <CardDescription>Job-specific logistics, separate from the quote's own notes</CardDescription>
          </CardHeader>
          <CardContent>
            {job.internal_notes ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.internal_notes}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No special instructions added.</p>
            )}
          </CardContent>
        </Card>

        {/* Post-Job Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Post-Job Notes</CardTitle>
            <CardDescription>Outcome, issues, or customer feedback after completion</CardDescription>
          </CardHeader>
          <CardContent>
            {job.customer_notes ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.customer_notes}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No post-job notes added.</p>
            )}
          </CardContent>
        </Card>

        {/* Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-400" />
              Assigned Crew
            </CardTitle>
          </CardHeader>
          <CardContent>
            {crewAssignments && crewAssignments.length > 0 ? (
              <div className="space-y-3">
                {crewAssignments.map((ca: any) => (
                  <div key={ca.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-slate-900">{ca.user?.full_name}</p>
                      <p className="text-xs text-slate-500">
                        Scheduled: {ca.scheduled_start ? format(new Date(ca.scheduled_start), 'h:mm a') : 'TBD'} -
                        {ca.scheduled_end ? format(new Date(ca.scheduled_end), ' h:mm a') : ' TBD'}
                      </p>
                      {(ca.actual_start || ca.actual_end) && (
                        <p className="text-xs text-emerald-600 mt-0.5">
                          Actual: {ca.actual_start ? format(new Date(ca.actual_start), 'h:mm a') : 'TBD'} -
                          {ca.actual_end ? format(new Date(ca.actual_end), ' h:mm a') : ' TBD'}
                        </p>
                      )}
                    </div>
                    <EditActualTimesForm
                      jobId={job.id}
                      assignmentId={ca.id}
                      actualStart={ca.actual_start ?? null}
                      actualEnd={ca.actual_end ?? null}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No crew assigned yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5 text-slate-400" />
              Assigned Vehicles
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vehicleAssignments && vehicleAssignments.length > 0 ? (
              <div className="space-y-3">
                {vehicleAssignments.map((va: any) => (
                  <div key={va.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-slate-900">{va.vehicle?.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{va.vehicle?.type?.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No vehicles assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
