import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getLeadById } from '@/modules/leads/server/repository'
import { getContactById, getAddressById } from '@/modules/clients/server/repository'
import { getTimeline } from '@/modules/activities/server/repository'
import { getQuotesForLead } from '@/modules/quotes/server/repository'
import { EditLeadForm } from './components/edit-lead-form'
import { EditContactForm } from '../../clients/[id]/components/edit-contact-form'
import { StageControl } from './components/stage-control'
import { QuotesList } from './components/quotes-list'
import { TimelineView } from '../../components/timeline-view'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MapPin, Mail, Phone, Building, Calendar, ArrowLeft, User } from 'lucide-react'
import Link from 'next/link'
import { KANBAN_STAGES } from '../constants'

export const dynamic = 'force-dynamic'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const supabase = await createClient()

  // 1. Authenticate and enforce Tenant Context
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }
  const tenantId = user.app_metadata.tenant_id

  // 2. Fetch Lead (Fail Closed — explicit tenant scoping)
  const { data: lead, error: leadError } = await getLeadById(supabase, tenantId, id)

  if (leadError || !lead) {
    notFound()
  }

  // 3. Fetch Contact (Fail Closed — explicit tenant scoping)
  const { data: contact, error: contactError } = await getContactById(supabase, tenantId, lead.contact_id)

  if (contactError || !contact) {
    notFound()
  }

  // 4. Fetch Addresses (if present in the lead)
  let originAddress = null
  let destinationAddress = null

  if (lead.origin_address_id) {
    const { data } = await getAddressById(supabase, tenantId, lead.origin_address_id)
    originAddress = data
  }

  if (lead.destination_address_id) {
    const { data } = await getAddressById(supabase, tenantId, lead.destination_address_id)
    destinationAddress = data
  }

  // 5. Fetch assigned-to user's full name (explicit tenant scoping, not RLS-only)
  let assignedToUser = null
  if (lead.assigned_to) {
    const { data: userData } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', lead.assigned_to)
      .eq('tenant_id', tenantId)
      .single()

    assignedToUser = userData
  }

  // 6. Fetch Timeline
  const { data: timelineItems } = await getTimeline(supabase, tenantId, { leadId: lead.id })

  // 7. Fetch Quotes
  const { data: quotes } = await getQuotesForLead(supabase, tenantId, lead.id)

  // 8. Fetch Tenant Staff for assignments
  const { getTenantStaff } = await import('@/modules/users/server/repository')
  const { data: tenantStaff } = await getTenantStaff(supabase, tenantId)

  // 8. Determine stage badge + control
  const stageConfig = KANBAN_STAGES.find((s) => s.id === lead.stage)
  const isEditableStage = KANBAN_STAGES.some((s) => s.id === lead.stage)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/office/leads" className="text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {contact.first_name} {contact.last_name || ''}
            </h1>
            {stageConfig && (
              <Badge style={{ backgroundColor: stageConfig.color, color: 'white' }}>
                {stageConfig.label}
              </Badge>
            )}
            {(lead as any).priority === 'high' && (
              <Badge variant="destructive">High Priority</Badge>
            )}
            {lead.is_archived && <Badge variant="destructive">Archived</Badge>}
            {lead.source && (
              <Badge variant="outline" className="bg-slate-50 text-slate-600 capitalize">
                {lead.source.replace(/_/g, ' ')}
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
          <StageControl leadId={lead.id} currentStage={lead.stage} isEditable={isEditableStage} />
          <EditLeadForm lead={lead} tenantStaff={tenantStaff || []} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Lead Details */}
        <div className="space-y-6 md:col-span-1">
          {/* Contact Info Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Contact Info</CardTitle>
              <EditContactForm contact={contact} />
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

              {((contact as any).preferred_contact_method || (contact as any).best_time_to_call) && (
                <>
                  <Separator />
                  {(contact as any).preferred_contact_method && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Preferred Contact Method</p>
                      <p className="text-sm text-slate-700 mt-1 capitalize">{(contact as any).preferred_contact_method}</p>
                    </div>
                  )}
                  {(contact as any).best_time_to_call && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Best Time to Call</p>
                      <p className="text-sm text-slate-700 mt-1">{(contact as any).best_time_to_call}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Lead Metadata Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Lead Info</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Priority</p>
                <p className="text-sm text-slate-700 mt-1 capitalize">{(lead as any).priority || 'medium'}</p>
              </div>

              {lead.source && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Source</p>
                  <p className="text-sm text-slate-700 mt-1">{lead.source}</p>
                </div>
              )}

              {lead.preferred_move_date && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Preferred Move Date</p>
                  <p className="text-sm text-slate-700 mt-1">
                    {new Date(lead.preferred_move_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              {lead.estimated_volume !== null && lead.estimated_volume !== undefined && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Estimated Volume</p>
                  <p className="text-sm text-slate-700 mt-1">{lead.estimated_volume} m³</p>
                </div>
              )}

              {assignedToUser && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Assigned To</p>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="h-4 w-4 text-slate-400" />
                    <p className="text-sm text-slate-700">{assignedToUser.full_name}</p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Lead Created</p>
                  <p className="text-sm text-slate-600">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Addresses & Notes & Activity */}
        <div className="space-y-6 md:col-span-2">
          {/* Addresses Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Move Details</CardTitle>
              <CardDescription>Origin and destination locations</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {originAddress ? (
                  <div className="p-4 rounded-lg border border-slate-100 bg-slate-50 flex gap-3">
                    <MapPin className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <Badge variant="outline" className="mb-2 text-xs uppercase font-semibold text-slate-500">
                        Origin
                      </Badge>
                      <p className="text-sm font-medium text-slate-900">{originAddress.line_1}</p>
                      {originAddress.line_2 && <p className="text-sm text-slate-600">{originAddress.line_2}</p>}
                      <p className="text-sm text-slate-600">
                        {originAddress.city}{originAddress.county ? `, ${originAddress.county}` : ''}{' '}
                        {originAddress.postcode}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                    No origin address set
                  </div>
                )}

                {destinationAddress ? (
                  <div className="p-4 rounded-lg border border-slate-100 bg-slate-50 flex gap-3">
                    <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <Badge variant="outline" className="mb-2 text-xs uppercase font-semibold text-slate-500">
                        Destination
                      </Badge>
                      <p className="text-sm font-medium text-slate-900">{destinationAddress.line_1}</p>
                      {destinationAddress.line_2 && <p className="text-sm text-slate-600">{destinationAddress.line_2}</p>}
                      <p className="text-sm text-slate-600">
                        {destinationAddress.city}{destinationAddress.county ? `, ${destinationAddress.county}` : ''}{' '}
                        {destinationAddress.postcode}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                    No destination address set
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Internal Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {lead.notes ? (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{lead.notes}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No notes added.</p>
              )}
            </CardContent>
          </Card>

          {/* Quotes List */}
          <QuotesList leadId={lead.id} contactId={lead.contact_id} quotes={quotes || []} />

          {/* Activity Timeline */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <TimelineView 
                items={timelineItems || []} 
                leadId={lead.id} 
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
