export default function ProposalRenderTest() {
  return (
    <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '40px' }}>
      <h1>Test Moving Company</h1>
      <h2>Your Moving Quote</h2>
      <div style={{ backgroundColor: 'white', color: '#1f2937', padding: '16px', marginTop: '20px', borderRadius: '4px' }}>
        <h3>Customer Details</h3>
        <p><strong>Name:</strong> John Doe</p>
        <p><strong>Email:</strong> john@test.com</p>
      </div>
      <div style={{ backgroundColor: 'white', color: '#1f2937', padding: '16px', marginTop: '20px', borderRadius: '4px' }}>
        <h3>Your Quote</h3>
        <p><strong>Base Service:</strong> $5,000.00</p>
        <p><strong>Surcharges:</strong> $500.00</p>
        <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb', marginTop: '10px' }}>
          Total: $5,500.00
        </p>
      </div>
    </div>
  )
}
