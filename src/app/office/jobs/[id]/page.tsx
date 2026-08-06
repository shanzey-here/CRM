import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getJobDetails } from '@/modules/jobs/server/repository'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, MapPin, Phone, Mail, User, Printer } from 'lucide-react'

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

  // 2. Fetch Job Details
  const { success, jobDetails, error } = await getJobDetails(supabase, tenantId, id)

  if (!success || !jobDetails) {
    notFound()
  }

  const job = jobDetails as any
  const contact = job.contact
  const origin = job.origin_address
  const dest = job.destination_address
  const quoteData = job.quote
  const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData

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
            <Badge variant="outline" className="bg-slate-50 text-slate-600 capitalize">
              {quote?.lead?.source ? quote.lead.source.replace(/_/g, ' ') : 'Unknown Source'}
            </Badge>
          </div>
          <p className="text-slate-500 mt-1">
            Scheduled for: {job.move_date ? format(new Date(job.move_date), 'EEEE, MMMM do, yyyy') : 'TBD'}
          </p>
        </div>
        
        {/* Print Job Sheet Action */}
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
      </div>
    </div>
  )
}
