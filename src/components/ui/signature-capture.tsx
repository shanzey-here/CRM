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
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-slate-700">Type Full Name</label>
          <input
            type="text"
            value={signatureName}
            onChange={(e) => onSignatureNameChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-md border-2 border-slate-300 focus:border-blue-500 focus:outline-none text-slate-900"
            placeholder="John Doe"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-slate-700">Draw Signature</label>
          <div className="border-2 border-slate-300 rounded-md bg-slate-50">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{ style: { width: '100%', height: '150px' } }}
            />
          </div>
          <button
            type="button"
            onClick={() => sigCanvas.current?.clear()}
            className="bg-transparent border-none text-slate-500 text-xs mt-2 cursor-pointer p-0 hover:text-slate-700"
          >
            Clear Signature
          </button>
        </div>
      </div>
    )
  }
)

SignatureCapture.displayName = 'SignatureCapture'
