import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { getJobDetails } from '@/modules/jobs/server/repository'
import { Printer } from 'lucide-react'
import { JobSheetContent } from '@/components/shared/job-sheet-content'

export const dynamic = 'force-dynamic'

export default async function JobSheetPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const supabase = await createClient()

  // 1. Authenticate and enforce Tenant Context (Exact same guard as /office)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }
  
  const appMetadata = user.app_metadata || {}
  const role = (appMetadata.tenant_role ?? appMetadata.role) as string | undefined
  const tenantId = appMetadata.tenant_id

  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    redirect('/login?error=unauthorized_role')
  }

  // 2. Fetch Job Details (tenant scoped)
  const { success, jobDetails, error } = await getJobDetails(supabase, tenantId, id)

  if (!success || !jobDetails) {
    notFound()
  }

  const job = jobDetails as any

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans print:p-0">
      <div className="max-w-4xl mx-auto space-y-8 print:max-w-none">
        
        {/* Print Toolbar (Hidden in actual print) */}
        <div className="flex justify-end print:hidden mb-8 border-b pb-4">
          <button 
            id="print-btn"
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-emerald-600 text-white shadow hover:bg-emerald-700 h-9 px-4 py-2"
          >
            <Printer className="mr-2 h-4 w-4" />
            <span>Print Document</span> 
          </button>
        </div>

        <JobSheetContent jobDetails={jobDetails} />

      </div>
      
      {/* Inline script to handle print button safely without 'use client' causing a layout cascade */}
      <script dangerouslySetInnerHTML={{
        __html: `
          const printBtn = document.getElementById('print-btn');
          if (printBtn) {
            printBtn.addEventListener('click', () => window.print());
          }
        `
      }} />
    </div>
  )
}
