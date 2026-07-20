'use client'

export function WidgetError({ error }: { error: Error }) {
  return (
    <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
      <h3 className="font-semibold text-sm">Failed to load</h3>
      <p className="text-xs">{error.message}</p>
    </div>
  )
}
