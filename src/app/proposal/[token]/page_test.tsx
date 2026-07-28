import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { notFound } from 'next/navigation'

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServiceRoleClient()

  const { data: quote } = await supabase
    .from('quotes')
    .select('*')
    .eq('public_token', token)
    .eq('status', 'sent')
    .single()

  if (!quote) notFound()

  return <div><h1>Quote: ${Number(quote.computed_price || 0).toFixed(2)}</h1></div>
}
