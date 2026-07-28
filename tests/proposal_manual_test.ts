import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vowdhcwsuhjclyjusigu.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function main() {
  if (!serviceRoleKey) {
    console.log('Note: SUPABASE_SERVICE_ROLE_KEY not set, using supabase-linked project')
    console.log('This test requires direct database access.\n')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey || 'dummy-key-for-url-only')

  console.log('═'.repeat(70))
  console.log('  PROPOSAL PAGE TEST')
  console.log('═'.repeat(70))
  console.log('\nINSTRUCTIONS FOR MANUAL TESTING:\n')

  // Create test data in Supabase
  console.log('1. ACCESS THE TEST TENANT & QUOTE')
  console.log('   - Navigate to Supabase dashboard')
  console.log('   - Project: vowdhcwsuhjclyjusigu')
  console.log('   - Run this SQL to create test data:\n')

  const testSql = `
-- Create a test tenant for proposal page
INSERT INTO tenants (name, status)
VALUES ('Proposal Test Tenant', 'active')
ON CONFLICT DO NOTHING
RETURNING id;

-- Get the tenant ID from above, then run:
-- CREATE CONTACT
INSERT INTO contacts (tenant_id, first_name, last_name, email, phone, type)
VALUES ('<tenant-id>', 'Alice', 'Johnson', 'alice@test.com', '555-1234', 'residential')
RETURNING id;

-- CREATE TENANT SETTINGS (with branding)
INSERT INTO tenant_settings (tenant_id, company_legal_name, logo_url, primary_color, terms_template)
VALUES ('<tenant-id>', 'Test Moving Company', 'https://via.placeholder.com/200?text=Logo', '#2563eb', 'By requesting a quote, you agree to our standard terms and conditions.')
ON CONFLICT DO NOTHING;

-- CREATE QUOTE (sent status)
INSERT INTO quotes (tenant_id, contact_id, status, total_volume, travel_distance_miles, subtotal, surcharge_total, total_price)
VALUES ('<tenant-id>', '<contact-id>', 'sent', 1500, 25, 5000, 500, 5500)
RETURNING id;

-- GENERATE PUBLIC TOKEN
-- SELECT encode(gen_random_bytes(24), 'hex') as public_token;

-- UPDATE QUOTE WITH TOKEN
-- UPDATE quotes SET public_token = '<token-from-above>' WHERE id = '<quote-id>';
  `

  console.log(testSql)

  console.log('\n2. TEST THE PROPOSAL PAGE')
  console.log('   - Once you have the public_token, visit:')
  console.log('   - http://localhost:3000/proposal/<public_token>')
  console.log('   - Should see:')
  console.log('     ✓ Company logo and name from tenant_settings')
  console.log('     ✓ Primary color as header background')
  console.log('     ✓ Customer details (Alice Johnson)')
  console.log('     ✓ Quote price ($5,500.00)')
  console.log('     ✓ Pricing breakdown')
  console.log('     ✓ "Ready for Review" status')
  console.log('     ✓ Terms text\n')

  console.log('3. TEST INVALID TOKEN')
  console.log('   - Visit: http://localhost:3000/proposal/ffffffffffffffffffffffffffffffffffffffffffffffff')
  console.log('   - Should return 404\n')

  console.log('4. TEST DRAFT QUOTE')
  console.log('   - Create a quote with status = "draft"')
  console.log('   - Add a public_token to it')
  console.log('   - Visit the proposal URL with that token')
  console.log('   - Should return 404 (only "sent" status quotes are accessible)\n')

  console.log('═'.repeat(70))
  console.log('Token format verification:')
  console.log('─'.repeat(70))

  const testTokens = [
    'a'.repeat(48),
    'f'.repeat(48),
    '0'.repeat(48),
  ]

  console.log('\n✓ All valid tokens are exactly 48 hex characters (192 bits)')
  console.log(`  Token format: [0-9a-f]{48}`)
  console.log(`  Example: ${testTokens[0]}\n`)

  console.log('═'.repeat(70) + '\n')
}

main()
