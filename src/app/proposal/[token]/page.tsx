import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { notFound } from 'next/navigation'
import { AcceptanceFlow } from './components/acceptance-flow'

interface ProposalPageProps {
  params: Promise<{ token: string }>
}

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { token } = await params

  const supabase = createServiceRoleClient()

  const { data: quote, error } = await supabase
    .from('quotes')
    .select(
      `
      *,
      contact:contacts!quotes_contact_fk(id, first_name, last_name, email, phone),
      lead:leads!quotes_lead_fk(id, origin_address_id, destination_address_id, preferred_move_date, estimated_volume)
    `
    )
    .eq('public_token', token)
    .in('status', ['sent', 'accepted'])
    .single()

  if (error || !quote) {
    notFound()
  }

  // Identity comes from this quote's own brand (brand_id, NOT NULL on
  // quotes since Part 3) — a multi-brand tenant's proposal must show the
  // brand that actually quoted it, not just the tenant's default.
  // primary_color remains tenant-wide (tenant_settings), unrelated to
  // brand identity.
  const [{ data: brand }, { data: settings }] = await Promise.all([
    supabase.from('brands').select('name, logo_url, terms_text').eq('id', quote.brand_id).single(),
    supabase.from('tenant_settings').select('primary_color').eq('tenant_id', quote.tenant_id).single(),
  ])

  const contact = (quote.contact as any) || {}
  const lead = (quote.lead as any) || {}
  const finalPrice = quote.final_price || quote.computed_price || 0
  const primaryColor = settings?.primary_color || '#1a56db'

  let originAddr = null
  let destAddr = null

  if (lead?.origin_address_id) {
    const res = await supabase
      .from('addresses')
      .select('line_1, city, postcode')
      .eq('id', lead.origin_address_id)
      .single()
    originAddr = res.data
  }

  if (lead?.destination_address_id) {
    const res = await supabase
      .from('addresses')
      .select('line_1, city, postcode')
      .eq('id', lead.destination_address_id)
      .single()
    destAddr = res.data
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ backgroundColor: primaryColor, color: 'white', padding: '32px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            {brand?.logo_url && (
              <img src={brand.logo_url} alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />
            )}
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', margin: 0 }}>
              {brand?.name || 'Proposal'}
            </h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '20px', margin: 0 }}>Your Moving Quote</h2>
            <span style={{ backgroundColor: 'white', color: '#1f2937', padding: '8px 16px', borderRadius: '8px', fontWeight: '600' }}>
              Ready for Review
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Customer Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '14px', color: '#6b7280' }}>Name</label>
                  <p style={{ fontWeight: '600', margin: '4px 0 0 0' }}>{contact.first_name} {contact.last_name}</p>
                </div>
                <div>
                  <label style={{ fontSize: '14px', color: '#6b7280' }}>Email</label>
                  <p style={{ fontWeight: '600', margin: '4px 0 0 0' }}>{contact.email || 'Not provided'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '14px', color: '#6b7280' }}>Phone</label>
                  <p style={{ fontWeight: '600', margin: '4px 0 0 0' }}>{contact.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Move Details</h3>
              <div style={{ display: 'grid', gap: '16px' }}>
                {originAddr && (
                  <div>
                    <label style={{ fontSize: '14px', color: '#6b7280' }}>From</label>
                    <p style={{ fontWeight: '600', margin: '4px 0 0 0', lineHeight: '1.5' }}>
                      {originAddr.line_1}<br />
                      {originAddr.city}, {originAddr.postcode}
                    </p>
                  </div>
                )}
                {destAddr && (
                  <div>
                    <label style={{ fontSize: '14px', color: '#6b7280' }}>To</label>
                    <p style={{ fontWeight: '600', margin: '4px 0 0 0', lineHeight: '1.5' }}>
                      {destAddr.line_1}<br />
                      {destAddr.city}, {destAddr.postcode}
                    </p>
                  </div>
                )}
                {lead?.preferred_move_date && (
                  <div>
                    <label style={{ fontSize: '14px', color: '#6b7280' }}>Move Date</label>
                    <p style={{ fontWeight: '600', margin: '4px 0 0 0' }}>
                      {new Date(lead.preferred_move_date).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {lead?.estimated_volume && (
                  <div>
                    <label style={{ fontSize: '14px', color: '#6b7280' }}>Volume</label>
                    <p style={{ fontWeight: '600', margin: '4px 0 0 0' }}>{lead.estimated_volume} cu-ft</p>
                  </div>
                )}
              </div>
            </div>

            {brand?.terms_text && (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Terms & Conditions</h3>
                <p style={{ color: '#4b5563', whiteSpace: 'pre-wrap', fontSize: '14px' }}>{brand.terms_text}</p>
              </div>
            )}
          </div>

          <div>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px', position: 'sticky', top: '32px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Your Quote</h3>
              <div style={{ display: 'grid', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Base Service</span>
                  <span style={{ fontWeight: '600' }}>${Number(quote.subtotal || 0).toFixed(2)}</span>
                </div>
                {quote.surcharge_total && Number(quote.surcharge_total) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6b7280' }}>Surcharges</span>
                    <span style={{ fontWeight: '600' }}>${Number(quote.surcharge_total).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
                  <span style={{ fontWeight: 'bold' }}>Total</span>
                  <span style={{ fontWeight: 'bold', color: primaryColor }}>
                    ${Number(finalPrice).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <AcceptanceFlow 
              token={token}
              primaryColor={primaryColor}
              depositAmount={Number(quote.deposit_amount || 0)}
              status={quote.status}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
