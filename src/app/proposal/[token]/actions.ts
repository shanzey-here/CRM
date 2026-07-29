'use server'

import { headers } from 'next/headers'
import crypto from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { getQuoteByPublicToken, saveQuoteSignature, markQuoteAccepted } from '@/modules/quotes/server/repository'
import { createDepositPaymentIntent, getOrCreateStripeCustomer } from '@/modules/payments/server/stripe'

export async function generatePaymentIntentAction(
  token: string,
  signatureData: {
    signatureName: string
    base64Image: string
  }
) {
  try {
    // 1. Verify quote mutability using Service Role (unauthenticated public route)
    const supabase = createServiceRoleClient()
    const { quote, success, error } = await getQuoteByPublicToken(supabase, token)

    if (!success || !quote) {
      return { success: false, error: error || 'Quote not found' }
    }

    if (quote.status !== 'sent') {
      return { success: false, error: 'Quote has already been accepted or is no longer valid.' }
    }

    // 2. Generate document hash representing the quote state at time of signing
    // This snapshot ensures the signed state is tamper-evident.
    const snapshot = {
      total_price: quote.total_price,
      deposit_amount: quote.deposit_amount,
      terms: quote.terms,
      valid_until: quote.valid_until,
      items_count: quote.quote_inventory?.length || 0,
      total_volume: quote.total_volume
    }
    const documentHash = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')

    // 3. Capture IP address for audit log
    const headersList = await headers()
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'

    // 4. Save Signature via Service Role (bypassing RLS)
    const sigResult = await saveQuoteSignature(
      supabase,
      quote.tenant_id,
      quote.id,
      signatureData.signatureName,
      signatureData.base64Image,
      documentHash,
      ipAddress
    )

    if (!sigResult.success) {
      return { success: false, error: sigResult.error }
    }

    // 5. Check Zero-Deposit scenario
    if (!quote.deposit_amount || quote.deposit_amount <= 0) {
      // Transition straight to accepted, bypassing Stripe
      const acceptResult = await markQuoteAccepted(supabase, quote.tenant_id, quote.id)
      if (!acceptResult.success) {
        return { success: false, error: acceptResult.error }
      }
      return { success: true, bypassed: true }
    }

    // 6. Deposit > 0: Generate Stripe PaymentIntent
    // We need the tenant's connected account ID
    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_connected_account_id')
      .eq('id', quote.tenant_id)
      .single()

    if (!tenant?.stripe_connected_account_id) {
      return { success: false, error: 'Tenant is not configured for payments. Contact support.' }
    }

    // Real card-on-file step: ensures this contact has a Stripe Customer so
    // the deposit payment method can be saved (setup_future_usage below)
    // and reused later for automatic crate-overdue/lost billing.
    const customerResult = await getOrCreateStripeCustomer(supabase, quote.tenant_id, quote.contact_id)
    if ('error' in customerResult) {
      return { success: false, error: `Failed to prepare payment: ${customerResult.error}` }
    }

    const paymentIntent = await createDepositPaymentIntent({
      amount: Number(quote.deposit_amount),
      tenantConnectedAccountId: tenant.stripe_connected_account_id,
      quoteId: quote.id,
      tenantId: quote.tenant_id,
      stripeCustomerId: customerResult.stripeCustomerId,
      contactId: quote.contact_id,
    })

    if (!paymentIntent.client_secret) {
      return { success: false, error: 'Failed to generate payment session.' }
    }

    return { 
      success: true, 
      clientSecret: paymentIntent.client_secret 
    }

  } catch (err: any) {
    console.error('generatePaymentIntentAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

export async function pollQuoteStatusAction(token: string) {
  // Uses Service Role to safely read the status
  const supabase = createServiceRoleClient()
  const { quote, success } = await getQuoteByPublicToken(supabase, token)
  
  if (!success || !quote) {
    return { status: 'unknown' }
  }
  
  return { status: quote.status }
}
