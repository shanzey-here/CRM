'use client'

import { useRef, useState } from 'react'
import { SignatureCapture, SignatureCaptureRef } from '@/components/ui/signature-capture'
import { queueSignoff } from '@/lib/offline-storage'
import { CheckCircle2, Clock, UploadCloud } from 'lucide-react'
import { useSignoffSync } from '../../../hooks/use-signoff-sync'

type JobSignoffProps = {
  jobId: string
  status: string
  onSyncComplete?: () => void
}

export function JobSignoff({ jobId, status, onSyncComplete }: JobSignoffProps) {
  const { pendingCount, isSyncing, loadPending } = useSignoffSync(jobId, onSyncComplete)
  const sigCaptureRef = useRef<SignatureCaptureRef>(null)
  
  const [signatureName, setSignatureName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // If the server tells us it's completed, it's done.
  // If the server says it's not completed, BUT we have pending signoffs in IDB,
  // we show the pending state (Honest Local State) instead of asking for another signature.
  
  if (status === 'completed') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center mt-8">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-emerald-800">Job Completed</h3>
        <p className="text-sm text-emerald-600">The customer signature has been confirmed by dispatch.</p>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 text-center mt-8">
        {isSyncing ? (
          <UploadCloud className="w-8 h-8 text-orange-600 mx-auto mb-2 animate-pulse" />
        ) : (
          <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
        )}
        <h3 className="text-lg font-semibold text-orange-800">
          {isSyncing ? 'Signed — syncing...' : 'Completed (pending sync)'}
        </h3>
        <p className="text-sm text-orange-600">
          The signature is saved locally. It will automatically upload and mark the job complete once connectivity is restored.
        </p>
      </div>
    )
  }

  const handleSubmit = async () => {
    setError(null)
    
    if (!signatureName.trim()) {
      setError('Please type the customer name.')
      return
    }
    
    if (sigCaptureRef.current?.isEmpty()) {
      setError('Please have the customer draw their signature.')
      return
    }

    const base64Image = sigCaptureRef.current?.getBase64Image() || ''
    
    try {
      await queueSignoff(jobId, signatureName, base64Image)
      // This will instantly update the UI to show the 'pending sync' state
      await loadPending()
    } catch (e: any) {
      setError('Failed to save signature: ' + e.message)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mt-8">
      <h3 className="text-lg font-bold mb-2">Job Sign-off</h3>
      <p className="text-sm text-slate-600 mb-6">
        Have the customer sign below to confirm all inventory was delivered and the job is complete.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm mb-4">
          {error}
        </div>
      )}

      <SignatureCapture 
        ref={sigCaptureRef}
        signatureName={signatureName}
        onSignatureNameChange={setSignatureName}
      />

      <button 
        onClick={handleSubmit}
        className="w-full mt-4 bg-orange-600 text-white font-bold py-3 px-4 rounded-md hover:bg-orange-700 transition-colors"
      >
        Sign & Complete Job
      </button>
    </div>
  )
}
