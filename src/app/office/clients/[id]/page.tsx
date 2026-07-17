import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getContactById, getContactAddresses } from '@/modules/clients/server/repository'
import { getTimeline } from '@/modules/activities/server/repository'
import { EditContactForm } from './components/edit-contact-form'
import { TimelineView } from '../components/timeline-view'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MapPin, Mail, Phone, Building, Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

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
          </div>
          {contact.company_name && (
            <p className="text-slate-500 flex items-center mt-1 text-sm">
              <Building className="h-4 w-4 mr-1.5" />
              {contact.company_name}
            </p>
          )}
        </div>
        
        <EditContactForm contact={contact} />
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

          {/* Placeholder for Leads/Jobs timeline */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Recent Moves</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                Lead and job history will appear here.
              </div>
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
              />
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
