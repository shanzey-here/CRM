import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getContacts, ContactFilterOptions } from '@/modules/clients/server/repository'
import ContactsClient from './components/contacts-client'

export const dynamic = 'force-dynamic' // Ensure page does not statically cache

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()

  // 1. Fetch User and Extract Tenant ID
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }

  const tenantId = user.app_metadata.tenant_id
  const resolvedParams = await searchParams

  // 2. Parse Search & Filter Parameters from URL
  const query = typeof resolvedParams.query === 'string' ? resolvedParams.query : undefined
  const type = (resolvedParams.type === 'residential' || resolvedParams.type === 'commercial')
    ? resolvedParams.type
    : undefined
  
  const page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page, 10) : 1
  const limit = 10
  const offset = (page - 1) * limit

  const options: ContactFilterOptions = {
    searchQuery: query,
    type,
    limit,
    offset
  }

  // 3. Fetch Contacts via Repository
  const { data: contacts, count, error } = await getContacts(supabase, tenantId, options)

  if (error) {
    console.error('Failed to fetch contacts:', error)
  }

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / limit)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Clients</h1>
          <p className="text-slate-500 mt-1">Manage your contacts and customers.</p>
        </div>
        {/* We can add a "Create Contact" button here in the future */}
      </div>

      <ContactsClient 
        initialContacts={contacts || []} 
        currentPage={page}
        totalPages={totalPages}
        currentQuery={query || ''}
        currentType={type || 'all'}
        totalCount={totalCount}
      />
    </div>
  )
}
