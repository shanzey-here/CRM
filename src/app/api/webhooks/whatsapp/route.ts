import { NextRequest, NextResponse } from 'next/server'

// Provider-agnostic webhook receiver for WhatsApp messages (Meta/360dialog)
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    
    // 1. Signature Verification Scaffold
    // Providers like 360dialog/Meta send a signature header (e.g., X-Hub-Signature or X-360dialog-Signature)
    // We will validate the HMAC SHA256 signature here using a shared secret.
    const signature = request.headers.get('x-hub-signature-256') || request.headers.get('x-360dialog-signature')
    
    if (process.env.WHATSAPP_WEBHOOK_SECRET && signature) {
      // TODO: Implement actual crypto.verify or subtleCrypto HMAC validation
      // const isValid = verifySignature(body, signature, process.env.WHATSAPP_WEBHOOK_SECRET)
      // if (!isValid) return new NextResponse('Invalid signature', { status: 401 })
    }

    // 2. Parse the payload after signature validation
    const payload = JSON.parse(body)

    // 3. 200-First-Then-Process Pattern
    // WhatsApp/Meta webhooks require extremely fast 200 OK responses to avoid retries and eventual rate-limiting.
    // We defer the actual processing (saving to DB, triggering UI updates) to background execution.
    // In Edge/Serverless Next.js, this means using something like `waitUntil` or a task queue.
    
    // TODO: Delegate to background task processor
    // e.g., enqueueWebhookTask(payload)
    console.log('[WhatsApp Webhook] Received payload:', JSON.stringify(payload).substring(0, 100) + '...')

    // Acknowledge receipt immediately
    return new NextResponse('OK', { status: 200 })
    
  } catch (error) {
    console.error('[WhatsApp Webhook] Error processing request:', error)
    // Still return 200 for parsing errors if we don't want the provider to keep retrying bad payloads, 
    // but 400 is safer if we want to log bad requests explicitly. 
    return new NextResponse('Bad Request', { status: 400 })
  }
}

// GET handler is required for initial Meta/360dialog webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  // Standard Meta verification challenge
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[WhatsApp Webhook] Verified successfully.')
    return new NextResponse(challenge, { status: 200 })
  } else {
    return new NextResponse('Forbidden', { status: 403 })
  }
}
