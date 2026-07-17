import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const url = 'https://vowdhcwsuhjclyjusigu.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function createFullTestQuote() {
  console.log('Creating test quote with lead and addresses...\n')

  // Find an existing tenant
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('name', 'Test Tenant A - Proposal')
    .limit(1)

  let tenantId = tenants?.[0]?.id

  if (!tenantId) {
    console.log('Creating new test tenant...')
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'Test Tenant Full Quote',
        slug: `test-full-quote-${Date.now()}`,
        status: 'active'
      })
      .select()
      .single()
    if (tenantError) {
      console.error('Error creating tenant:', tenantError)
      throw tenantError
    }
    tenantId = newTenant!.id
  }

  console.log(`Using tenant: ${tenantId}`)

  // Create tenant settings if not exists
  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)

  if (!settings?.length) {
    await supabase.from('tenant_settings').insert({
      tenant_id: tenantId,
      company_legal_name: 'Test Moving Company Full',
      logo_url: 'https://via.placeholder.com/150?text=Logo',
      primary_color: '#1a56db',
      terms_template: 'Standard terms and conditions.',
    })
  }

  // Create contact
  const { data: contact } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      phone: '555-9876',
      type: 'residential',
    })
    .select()
    .single()

  console.log(`Created contact: ${contact!.id} (Jane Smith)`)

  // Create origin address
  const { data: originAddr, error: originError } = await supabase
    .from('addresses')
    .insert({
      tenant_id: tenantId,
      line_1: '123 Oak Street',
      line_2: 'Apt 4B',
      city: 'Portland',
      county: 'Multnomah',
      postcode: '97214',
      country: 'USA',
    })
    .select()
    .single()

  if (originError) {
    console.error('Error creating origin address:', originError)
    throw originError
  }

  console.log(`Created origin address: ${originAddr!.id}`)
  console.log(`  From: 123 Oak Street, Apt 4B, Portland, Multnomah, 97214, USA`)

  // Create destination address
  const { data: destAddr, error: destError } = await supabase
    .from('addresses')
    .insert({
      tenant_id: tenantId,
      line_1: '456 Elm Avenue',
      line_2: 'Suite 200',
      city: 'Seattle',
      county: 'King',
      postcode: '98101',
      country: 'USA',
    })
    .select()
    .single()

  if (destError) {
    console.error('Error creating destination address:', destError)
    throw destError
  }

  console.log(`Created destination address: ${destAddr!.id}`)
  console.log(`  To: 456 Elm Avenue, Suite 200, Seattle, King, 98101, USA`)

  // Create lead
  const moveDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      contact_id: contact!.id,
      origin_address_id: originAddr!.id,
      destination_address_id: destAddr!.id,
      preferred_move_date: moveDate,
      estimated_volume: 2500,
      stage: 'quote_sent',
      source: 'website_form',
    })
    .select()
    .single()

  if (leadError) {
    console.error('Error creating lead:', leadError)
    throw leadError
  }

  console.log(`Created lead: ${lead!.id} (move date: ${moveDate}, volume: 2500 cu-ft)`)

  // Create quote linked to lead
  const { data: quote } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      contact_id: contact!.id,
      lead_id: lead!.id,
      status: 'sent',
      subtotal: 7500,
      surcharge_total: 750,
      total_price: 8250,
      computed_price: 8250,
    })
    .select()
    .single()

  console.log(`Created quote: ${quote!.id}`)

  // Generate public token
  const { data: token } = await supabase.rpc('generate_proposal_token')
  console.log(`Generated token: ${token}`)

  // Update quote with token
  await supabase
    .from('quotes')
    .update({ public_token: token })
    .eq('id', quote!.id)

  console.log(`\n✅ Test quote created with full data!\n`)
  console.log(`URL: http://localhost:3000/proposal/${token}`)
  console.log(`\nExpected to see:`)
  console.log(`  Customer: Jane Smith / jane@example.com / 555-9876`)
  console.log(`  From: 123 Oak Street, Apt 4B, Portland, OR 97214`)
  console.log(`  To: 456 Elm Avenue, Suite 200, Seattle, WA 98101`)
  console.log(`  Move Date: ${moveDate}`)
  console.log(`  Volume: 2500 cu-ft`)
  console.log(`  Pricing: $7500 + $750 = $8250`)
}

createFullTestQuote().catch(console.error)
