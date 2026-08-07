export function WidgetError({ message }: { message: string }) {
  return (
    <div className="p-4 bg-white text-red-600 rounded-lg border border-red-200 shadow-sm">
      <h3 className="font-semibold text-sm">Failed to load</h3>
      <p className="text-xs">{message}</p>
    </div>
  )
}
