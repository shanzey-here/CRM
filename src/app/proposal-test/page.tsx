export default function ProposalTestPage() {
  const quote = {
    id: '47ac9cee',
    computed_price: 5500,
    final_price: null,
    subtotal: 5000,
    surcharge_total: 500,
  }
  const contact = {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@test.com',
    phone: '555-0001',
  }
  const originAddr = {
    line_1: '123 Oak Street',
    city: 'New York',
    postcode: '10001',
  }
  const destAddr = {
    line_1: '456 Elm Avenue',
    city: 'Boston',
    postcode: '02101',
  }
  const tenant = {
    company_legal_name: 'Test Moving Company',
    logo_url: 'https://via.placeholder.com/150?text=TestCo',
    primary_color: '#2563eb',
    terms_template: 'By requesting a quote, you agree to our standard terms and conditions. All estimates are valid for 30 days.',
  }
  const lead = {
    preferred_move_date: '2026-08-15',
    estimated_volume: 1500,
  }

  const finalPrice = quote.final_price || quote.computed_price || 0
  const primaryColor = tenant?.primary_color || '#1a56db'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <div style={{ backgroundColor: primaryColor, color: 'white', padding: '32px 0' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            {tenant?.logo_url && (
              <img src={tenant.logo_url} alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />
            )}
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', margin: 0 }}>
              {tenant?.company_legal_name || 'Proposal'}
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

            {tenant?.terms_template && (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Terms & Conditions</h3>
                <p style={{ color: '#4b5563', whiteSpace: 'pre-wrap', fontSize: '14px' }}>{tenant.terms_template}</p>
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

            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>What's Next?</h3>
              <p style={{ color: '#4b5563', fontSize: '14px', lineHeight: '1.5', margin: 0 }}>
                Ready to move forward? We'll follow up shortly to finalize your booking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
