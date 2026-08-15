'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { regenerateWidgetKeyAction } from '../actions'

interface BrandWidget {
  id: string
  name: string
  widgetKey: string
}

export function WebWidgetSettingsClient({ brands }: { brands: BrandWidget[] }) {
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  return (
    <div className="space-y-10">
      {brands.map((brand) => (
        <BrandWidgetCard key={brand.id} brand={brand} origin={origin} showName={brands.length > 1} />
      ))}
    </div>
  )
}

function BrandWidgetCard({ brand, origin, showName }: { brand: BrandWidget; origin: string; showName: boolean }) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const embedUrl = `${origin}/embed/lead-capture/${brand.widgetKey}`
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="800" frameborder="0" style="border:none; overflow:hidden;"></iframe>`

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    if (!confirm('Are you sure you want to regenerate the key? Any existing embedded forms on external websites will immediately stop working until you update their code snippets.')) {
      return
    }

    setIsRegenerating(true)
    const result = await regenerateWidgetKeyAction(brand.id)
    setIsRegenerating(false)

    if (result.error) {
      alert(result.error)
    }
  }

  return (
    <div className="space-y-8">
      {showName && <h3 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">{brand.name}</h3>}

      {/* Code Snippet Section */}
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Embed Code</h3>
        <p className="text-sm text-gray-500 mb-4">
          Copy and paste this HTML snippet into your website builder (WordPress, Wix, Webflow, etc.) where you want the form to appear.
        </p>

        <div className="relative">
          <pre className="bg-slate-900 text-slate-50 p-4 rounded-md overflow-x-auto text-sm font-mono whitespace-pre-wrap break-all">
            {iframeCode}
          </pre>
          <div className="absolute top-2 right-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopy}
              className="bg-white/10 hover:bg-white/20 text-white border-none"
            >
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-6 rounded-lg border border-red-100">
        <h3 className="text-sm font-semibold text-red-900 mb-2">Danger Zone</h3>
        <p className="text-sm text-red-700 mb-4">
          If this embed code has been compromised, you can regenerate its key. <strong>Warning:</strong> This will instantly break all existing forms currently embedded on websites using this brand's snippet.
        </p>
        <Button
          variant="destructive"
          onClick={handleRegenerate}
          disabled={isRegenerating}
        >
          {isRegenerating ? 'Regenerating...' : 'Regenerate Key'}
        </Button>
      </div>

      {/* Preview Section */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Live Preview</h3>
          <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">Desktop View</span>
        </div>
        <div className="bg-slate-50 p-8 flex justify-center">
          {origin ? (
            <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden ring-1 ring-black/5" style={{ minHeight: '800px' }}>
              <iframe
                src={embedUrl}
                width="100%"
                height="800"
                style={{ border: 'none', overflow: 'hidden' }}
                title={`${brand.name} Widget Preview`}
              />
            </div>
          ) : (
            <div className="h-[800px] flex items-center justify-center text-slate-400">Loading preview...</div>
          )}
        </div>
      </div>
    </div>
  )
}
