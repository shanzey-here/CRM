'use client'

import { useRef, useImperativeHandle, forwardRef } from 'react'
import SignatureCanvas from 'react-signature-canvas'

export type SignatureCaptureRef = {
  getSignatureName: () => string
  isEmpty: () => boolean
  getBase64Image: () => string
  clear: () => void
}

type SignatureCaptureProps = {
  signatureName: string
  onSignatureNameChange: (name: string) => void
}

export const SignatureCapture = forwardRef<SignatureCaptureRef, SignatureCaptureProps>(
  ({ signatureName, onSignatureNameChange }, ref) => {
    const sigCanvas = useRef<SignatureCanvas>(null)

    useImperativeHandle(ref, () => ({
      getSignatureName: () => signatureName,
      isEmpty: () => sigCanvas.current?.isEmpty() ?? true,
      getBase64Image: () => sigCanvas.current?.getCanvas().toDataURL('image/png') || '',
      clear: () => {
        sigCanvas.current?.clear()
        onSignatureNameChange('')
      }
    }))

    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Type Full Name</label>
          <input 
            type="text" 
            value={signatureName}
            onChange={(e) => onSignatureNameChange(e.target.value)}
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
      </div>
    )
  }
)

SignatureCapture.displayName = 'SignatureCapture'
