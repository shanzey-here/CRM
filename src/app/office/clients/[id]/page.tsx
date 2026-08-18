import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getContactById, getContactAddresses, getContactRelocationHistory } from '@/modules/clients/server/repository'
import { getContactPricingOverride } from '@/modules/clients/server/pricing-overrides'
import { getTimeline } from '@/modules/activities/server/repository'
import { EditContactForm } from './components/edit-contact-form'
import { CreateLeadForm } from './components/create-lead-form'
import { NegotiatedRateCard } from './components/negotiated-rate-card'
import { TimelineView } from '../../components/timeline-view'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MapPin, Mail, Phone, Building, Calendar, ArrowLeft, Truck } from 'lucide-react'
import Link from 'next/link'

const JOB_STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString()
}

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const supabase = await createClient()

  // 1. Authenticate and enforce Tenant Context
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }
  const tenantId = user.app_metadata.tenant_id

  // 2. Fetch Contact (Fail Closed)
  const { data: contact, error } = await getContactById(supabase, tenantId, id)
  
  // If the query returns nothing (e.g. invalid ID or cross-tenant query blocked by explicit .eq),
  // we immediately return a 404. The data never leaves the database context.
  if (error || !contact) {
    notFound()
  }

  // 3. Fetch Linked Addresses
  const { data: addressLinks } = await getContactAddresses(supabase, tenantId, id)

  // 4. Fetch Timeline
  const { data: timelineItems } = await getTimeline(supabase, tenantId, { contactId: id })

  // 5. Fetch Tenant Staff for assignments
  const { getTenantStaff } = await import('@/modules/users/server/repository')
  const { data: tenantStaff } = await getTenantStaff(supabase, tenantId)

  // 5b. Fetch brands for the Create Lead form's brand selector
  const { getBrands } = await import('@/modules/settings/brands/server/repository')
  const { data: brands } = await getBrands(supabase, tenantId)

  // 6. Fetch LTV (if entitled)
  const { getContactLtv, getRepeatCustomers } = await import('@/modules/analytics/server/repository')
  let ltv: number | null = null
  let ltvError: string | null = null
  try {
    ltv = await getContactLtv(supabase, tenantId, id)
  } catch (e: any) {
    if (e?.code === 'PT403') {
      ltvError = 'Advanced Analytics required'
    } else {
      ltvError = 'Unavailable'
    }
  }

  // 7. Repeat-customer badge — reuses get_repeat_customers() as-is, tenant-wide,
  // checked for membership of this contact. Silently omitted if not entitled/errored,
  // since it's a flourish rather than a headline number like LTV.
  let isRepeatCustomer = false
  try {
    const repeatCustomers = await getRepeatCustomers(supabase, tenantId)
    isRepeatCustomer = repeatCustomers.some((r) => r.contact_id === id)
  } catch {
    isRepeatCustomer = false
  }

  // 8. Relocation history — every job (any status) + non-accepted (declined/expired) quotes
  const { jobs: historyJobs, nonAcceptedQuotes } = await getContactRelocationHistory(supabase, tenantId, id)

  type TimelineEvent =
    | { kind: 'job'; sortDate: string; job: (typeof historyJobs)[number] }
    | { kind: 'quote'; sortDate: string; quote: (typeof nonAcceptedQuotes)[number] }

  const jobEvents: TimelineEvent[] = historyJobs.map((j) => ({
    kind: 'job',
    sortDate: j.move_date ?? j.created_at,
    job: j,
  }))
  const quoteEvents: TimelineEvent[] = nonAcceptedQuotes.map((q) => ({
    kind: 'quote',
    sortDate: q.valid_until ?? q.created_at,
    quote: q,
  }))
  const relocationTimeline = [...jobEvents, ...quoteEvents].sort((a, b) => b.sortDate.localeCompare(a.sortDate))

  const completedJobs = historyJobs.filter((j) => j.status === 'completed')
  const completedMoveDates = completedJobs.map((j) => j.move_date).filter((d): d is string => !!d).sort()
  const totalMoves = completedJobs.length
  const firstMoveDate = completedMoveDates[0] ?? null
  const mostRecentMoveDate = completedMoveDates[completedMoveDates.length - 1] ?? null

  // 9. Negotiated rate — tenant_admin-only card. Eligibility is fully
  // manual; not gated by the repeat-customer/LTV data above.
  const tenantRole = user.app_metadata?.tenant_role
  const { data: pricingOverride } = await getContactPricingOverride(supabase, tenantId, id)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/office/clients" className="text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {contact.first_name} {contact.last_name || ''}
            </h1>
            <Badge variant="secondary" className={
              contact.type === 'commercial' 
                ? 'bg-blue-50 text-blue-700' 
                : 'bg-emerald-50 text-emerald-700'
            }>
              {contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}
            </Badge>
            {contact.is_archived && <Badge variant="destructive">Archived</Badge>}
            {isRepeatCustomer && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                Repeat Customer
              </Badge>
            )}
          </div>
          {contact.company_name && (
            <p className="text-slate-500 flex items-center mt-1 text-sm">
              <Building className="h-4 w-4 mr-1.5" />
              {contact.company_name}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <EditContactForm contact={contact} />
          <CreateLeadForm contactId={contact.id} brands={brands || []} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Contact Details */}
        <div className="space-y-6 md:col-span-1">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {contact.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Email</p>
                    <a href={`mailto:${contact.email}`} className="text-sm text-emerald-600 hover:underline">
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}
              
              {contact.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Phone</p>
                    <a href={`tel:${contact.phone}`} className="text-sm text-slate-600 hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                </div>
              )}

              {contact.alt_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Alt Phone</p>
                    <a href={`tel:${contact.alt_phone}`} className="text-sm text-slate-600 hover:underline">
                      {contact.alt_phone}
                    </a>
                  </div>
                </div>
              )}
              
              <Separator />

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Customer Since</p>
                  <p className="text-sm text-slate-600">
                    {new Date(contact.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mt-0.5">
                  <span className="text-xs font-bold">$</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Total Collected Revenue (LTV)</p>
                  {ltv !== null ? (
                    <p className="text-lg font-bold text-emerald-600">
                      ${ltv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 italic mt-0.5">{ltvError}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Internal Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {contact.notes ? (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{contact.notes}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No notes added.</p>
              )}
            </CardContent>
          </Card>

          {/* Negotiated Rate — tenant_admin-only, a commercial/financial
              decision, same access tier as staff/billing settings. */}
          {tenantRole === 'tenant_admin' && (
            <NegotiatedRateCard contactId={contact.id} override={pricingOverride} />
          )}
        </div>

        {/* Right Column: Address Book & Activity */}
        <div className="space-y-6 md:col-span-2">
          
          {/* Address Book */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Address Book</CardTitle>
                <CardDescription>Locations formally linked to this contact</CardDescription>
              </div>
              {/* Add Address feature goes here in future iterations */}
            </CardHeader>
            <CardContent className="pt-4">
              {addressLinks && addressLinks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addressLinks.map((link) => {
                    const address = link.addresses
                    if (!address) return null
                    
                    return (
                      <div key={link.id} className="p-4 rounded-lg border border-slate-100 bg-slate-50 flex gap-3">
                        <MapPin className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          {link.label && (
                            <Badge variant="outline" className="mb-2 text-xs uppercase font-semibold text-slate-500">
                              {link.label}
                            </Badge>
                          )}
                          <p className="text-sm font-medium text-slate-900">{address.line_1}</p>
                          {address.line_2 && <p className="text-sm text-slate-600">{address.line_2}</p>}
                          <p className="text-sm text-slate-600">
                            {address.city}{address.county ? `, ${address.county}` : ''} {address.postcode}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                  No addresses have been linked to this contact yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relocation History */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Relocation History</CardTitle>
              <CardDescription>Every job and non-accepted quote on record for this contact</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500">Total Moves</p>
                  <p className="text-lg font-bold text-slate-900">{totalMoves}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500">Total LTV</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {ltv !== null ? formatCurrency(ltv) : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500">First Move</p>
                  <p className="text-sm font-medium text-slate-900">
                    {firstMoveDate ? formatDate(firstMoveDate) : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500">Most Recent Move</p>
                  <p className="text-sm font-medium text-slate-900">
                    {mostRecentMoveDate ? formatDate(mostRecentMoveDate) : '—'}
                  </p>
                </div>
              </div>

              {/* Chronological timeline */}
              {relocationTimeline.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                  No jobs or quotes recorded for this contact yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {relocationTimeline.map((event) => {
                    if (event.kind === 'job') {
                      const job = event.job
                      const quoteData = job.quote
                      const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData
                      const origin = job.origin_address
                      const dest = job.destination_address
                      return (
                        <li key={`job-${job.id}`}>
                          <Link
                            href={`/office/jobs/${job.id}`}
                            className="flex items-center justify-between gap-3 text-sm p-3 rounded-lg border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Truck className="h-4 w-4 text-slate-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className={`text-xs uppercase ${JOB_STATUS_BADGE[job.status] || ''}`}>
                                    {job.status.replace('_', ' ')}
                                  </Badge>
                                  {quote?.lead?.source && (
                                    <span className="text-xs text-slate-500 capitalize px-1.5 py-0.5 bg-slate-100 rounded shrink-0">
                                      {quote.lead.source.replace(/_/g, ' ')}
                                    </span>
                                  )}
                                  <span className="text-slate-700 truncate">
                                    {origin?.city || 'Unknown'} &rarr; {dest?.city || 'Unknown'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {job.move_date ? formatDate(job.move_date) : `Booked ${formatDate(job.created_at)}`}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-medium text-slate-900 shrink-0">
                              {quote?.total_price != null ? formatCurrency(quote.total_price) : '—'}
                            </span>
                          </Link>
                        </li>
                      )
                    }

                    const quote = event.quote
                    return (
                      <li key={`quote-${quote.id}`}>
                        <div className="flex items-center justify-between gap-3 text-sm p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-4 w-4 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs uppercase text-slate-500">
                                  Quote &mdash; {quote.status}
                                </Badge>
                                {quote.lead?.source && (
                                  <span className="text-xs text-slate-500 capitalize px-1.5 py-0.5 bg-slate-100 rounded shrink-0">
                                    {quote.lead.source.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {quote.valid_until ? `Valid until ${formatDate(quote.valid_until)}` : formatDate(quote.created_at)}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-slate-500 shrink-0">
                            {formatCurrency(quote.total_price)}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <TimelineView 
                items={timelineItems || []} 
                contactId={contact.id} 
                currentUserId={user.id} 
                tenantStaff={tenantStaff || []}
              />
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
