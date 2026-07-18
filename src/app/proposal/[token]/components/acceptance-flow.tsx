'use client'

import { useState, useRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { generatePaymentIntentAction, pollQuoteStatusAction } from '../actions'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_PUBLISHABLE_KEY || '')

type AcceptanceFlowProps = {
  token: string
  primaryColor: string
  depositAmount: number
  status: string
}

export function AcceptanceFlow({ token, primaryColor, depositAmount, status }: AcceptanceFlowProps) {
  const [signatureName, setSignatureName] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'sign' | 'pay' | 'processing' | 'success'>(
    status === 'accepted' ? 'success' : 'sign'
  )
  
  const sigCanvas = useRef<SignatureCanvas>(null)

  if (view === 'success' || status === 'accepted') {
    return (
      <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46', marginBottom: '8px' }}>Quote Accepted!</h3>
        <p style={{ color: '#047857', fontSize: '14px', margin: 0 }}>
          Thank you for confirming your booking. We will be in touch shortly.
        </p>
      </div>
    )
  }

  const handleSignatureSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!signatureName.trim()) {
      setError('Please type your full name to sign.')
      return
    }
    
    if (sigCanvas.current?.isEmpty()) {
      setError('Please draw your signature.')
      return
    }

    setIsSubmitting(true)
    
    const base64Image = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || ''

    const result = await generatePaymentIntentAction(token, {
      signatureName,
      base64Image,
    })

    if (!result.success) {
      setError(result.error || 'Failed to process signature.')
      setIsSubmitting(false)
      return
    }

    if (result.bypassed) {
      // Zero-deposit bypassed Stripe
      setView('success')
    } else if (result.clientSecret) {
      setClientSecret(result.clientSecret)
      setView('pay')
    }
    setIsSubmitting(false)
  }

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '24px' }}>
      
      {view === 'sign' && (
        <form onSubmit={handleSignatureSubmit}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>Review & Sign</h3>
          <p style={{ color: '#4b5563', fontSize: '14px', marginBottom: '16px' }}>
            By signing below, you agree to the terms and conditions outlined in this proposal.
          </p>
          
          {error && (
            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Type Full Name</label>
            <input 
              type="text" 
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              placeholder="John Doe"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Draw Signature</label>
            <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
              <SignatureCanvas 
                ref={sigCanvas}
                canvasProps={{ style: { width: '100%', height: '150px' } }}
              />
            </div>
            <button 
              type="button" 
              onClick={() => sigCanvas.current?.clear()}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', marginTop: '8px', cursor: 'pointer', padding: 0 }}
            >
              Clear Signature
            </button>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            style={{ 
              width: '100%', 
              backgroundColor: isSubmitting ? '#9ca3af' : primaryColor, 
              color: 'white', 
              padding: '12px', 
              borderRadius: '6px', 
              fontWeight: 'bold',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? 'Processing...' : (depositAmount > 0 ? 'Sign & Proceed to Payment' : 'Accept Quote')}
          </button>
        </form>
      )}

      {view === 'pay' && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm 
            primaryColor={primaryColor} 
            onSuccess={() => setView('processing')} 
            token={token}
          />
        </Elements>
      )}

      {view === 'processing' && (
        <ProcessingConfirmation token={token} onSuccess={() => setView('success')} />
      )}
    </div>
  )
}

function PaymentForm({ primaryColor, onSuccess, token }: { primaryColor: string, onSuccess: () => void, token: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsProcessing(true)
    setError(null)

    // confirmPayment will handle the actual payment intent completion
    const { error: submitError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // We don't want a hard redirect if we can avoid it
    })

    if (submitError) {
      setError(submitError.message || 'Payment failed.')
      setIsProcessing(false)
    } else {
      // Payment succeeded on client side
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Deposit Payment</h3>
      {error && (
        <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      <PaymentElement />
      <button 
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        style={{ 
          width: '100%', 
          backgroundColor: isProcessing ? '#9ca3af' : primaryColor, 
          color: 'white', 
          padding: '12px', 
          borderRadius: '6px', 
          fontWeight: 'bold',
          border: 'none',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          marginTop: '24px'
        }}
      >
        {isProcessing ? 'Processing...' : 'Pay Deposit'}
      </button>
    </form>
  )
}

function ProcessingConfirmation({ token, onSuccess }: { token: string, onSuccess: () => void }) {
  const [timeoutReached, setTimeoutReached] = useState(false)

  // Poll server for status every 2 seconds
  useState(() => {
    let attempts = 0
    const maxAttempts = 7 // 14 seconds

    const poll = async () => {
      attempts++
      const { status } = await pollQuoteStatusAction(token)
      if (status === 'accepted') {
        onSuccess()
      } else if (attempts >= maxAttempts) {
        setTimeoutReached(true)
      } else {
        setTimeout(poll, 2000)
      }
    }

    poll()
  })

  if (timeoutReached) {
    return (
      <div style={{ textAlign: 'center', padding: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#047857', marginBottom: '12px' }}>Payment Successful!</h3>
        <p style={{ color: '#4b5563', fontSize: '14px' }}>
          Your payment was successful, but confirmation is slightly delayed. It may take a minute for the system to fully update your quote status. Please check your email for the final confirmation.
        </p>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '24px' }}>
      <div style={{ marginBottom: '16px' }}>
        {/* Simple inline spinner */}
        <div style={{
          display: 'inline-block',
          width: '32px',
          height: '32px',
          border: '3px solid #f3f4f6',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Finalizing Confirmation...</h3>
      <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>Please don't close this window.</p>
    </div>
  )
}
