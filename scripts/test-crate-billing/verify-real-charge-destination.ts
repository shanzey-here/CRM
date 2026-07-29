import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PAYMENT_INTENT_ID = 'pi_3TyOZMQp3NRxZP6h0BWYdOFV'
const CRATE_CHARGE_ID = 'd7fd525c-4d34-40d0-81e4-3f36c01f7815'
const CONNECTED_ACCOUNT_ID = 'acct_1TyMT1JnACsbptOm'
const PLATFORM_ACCOUNT_ID = 'acct_1Tv4lMQp3NRxZP6h'

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // 1. The real PaymentIntent, fetched directly from Stripe
  const pi = await stripe.paymentIntents.retrieve(PAYMENT_INTENT_ID, { expand: ['latest_charge', 'transfer_data'] })
  console.log('=== Real PaymentIntent (platform account) ===')
  console.log('id:', pi.id)
  console.log('status:', pi.status)
  console.log('amount:', pi.amount, pi.currency)
  console.log('transfer_data.destination:', (pi as any).transfer_data?.destination)
  console.log('on_behalf_of:', pi.on_behalf_of)
  console.log('metadata:', JSON.stringify(pi.metadata))

  const destinationId = typeof (pi as any).transfer_data?.destination === 'string' ? (pi as any).transfer_data.destination : (pi as any).transfer_data?.destination?.id
  console.log('\nDestination matches the real connected account (not platform)?', destinationId === CONNECTED_ACCOUNT_ID)
  console.log('Destination is NOT the platform account?', destinationId !== PLATFORM_ACCOUNT_ID)

  // 2. Fetch the actual balance/charge that landed ON the connected account
  const charge = pi.latest_charge as Stripe.Charge
  console.log('\n=== Real Charge ===')
  console.log('charge id:', charge.id)
  console.log('charge status:', charge.status)
  console.log('destination (on the charge object):', charge.destination)

  // 3. List balance transactions directly ON the connected account, using
  // the Stripe-Account header, to prove funds genuinely exist there —
  // the most direct possible proof, from the connected account's own ledger.
  const balanceTransactions = await stripe.balanceTransactions.list({ limit: 5 }, { stripeAccount: CONNECTED_ACCOUNT_ID })
  console.log('\n=== Real balance transactions on the CONNECTED account itself ===')
  console.log(
    JSON.stringify(
      balanceTransactions.data.map((bt) => ({ id: bt.id, amount: bt.amount, currency: bt.currency, type: bt.type, description: bt.description, source: bt.source })),
      null,
      2
    )
  )

  const connectedBalance = await stripe.balance.retrieve(undefined as any, { stripeAccount: CONNECTED_ACCOUNT_ID })
  console.log('\n=== Real current balance ON the connected account ===')
  console.log(JSON.stringify(connectedBalance.available), JSON.stringify(connectedBalance.pending))

  // 4. Real invoice row
  const { data: charge_row } = await supabase.from('crate_charges').select('invoice_id').eq('id', CRATE_CHARGE_ID).single()
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', charge_row!.invoice_id).single()
  console.log('\n=== Real invoice row ===')
  console.log(JSON.stringify(invoice, null, 2))
}
main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
