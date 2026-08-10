import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { CaptureForm } from './components/capture-form'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Request a Quote',
}

interface PageProps {
  params: Promise<{ widgetKey: string }>
}

export default async function LeadCapturePage({ params }: PageProps) {
  const { widgetKey } = await params
  const supabase = createServiceRoleClient()

  // 1. Look up tenant by widget key
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('public_widget_key', widgetKey)
    .single()

  if (error || !tenant) {
    // Deliberately minimalistic 404 to avoid leaking tenant info
    notFound()
  }

  return (
    <div className="min-h-screen bg-transparent p-4 flex flex-col">
      <div className="max-w-2xl w-full mx-auto flex-1 flex flex-col">
        <CaptureForm widgetKey={widgetKey} tenantName={tenant.name} />
      </div>
    </div>
  )
}
