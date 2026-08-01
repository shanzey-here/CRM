import { format } from 'date-fns'
import { MapPin } from 'lucide-react'

export function JobSheetContent({ jobDetails }: { jobDetails: any }) {
  const job = jobDetails
  const contact = job.contact
  const origin = job.origin_address
  const dest = job.destination_address
  const quoteData = job.quote
  const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData
  
  // Flatten inventory for the print sheet
  const inventory = quote?.quote_inventory || []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b-2 border-black pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-widest">Job Sheet</h1>
          <p className="text-xl mt-2 font-medium">Job ID: {job.id.split('-')[0]}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">
            {job.move_date ? format(new Date(job.move_date), 'EEEE, MMM do, yyyy') : 'DATE TBD'}
          </p>
          <p className="text-lg mt-1 font-medium text-gray-700 uppercase">{job.status.replace('_', ' ')}</p>
        </div>
      </div>

      {/* Customer Information */}
      <section>
        <h2 className="text-xl font-bold border-b border-gray-300 pb-2 mb-4 uppercase text-gray-500 tracking-wider">Customer</h2>
        <div className="grid grid-cols-2 gap-4 text-lg">
          <div>
            <p className="font-bold">{contact?.first_name} {contact?.last_name}</p>
            {contact?.company_name && <p className="text-gray-600">{contact.company_name}</p>}
          </div>
          <div className="text-right">
            {contact?.phone && <p>{contact.phone}</p>}
            {contact?.email && <p>{contact.email}</p>}
          </div>
        </div>
      </section>

      {/* Locations */}
      <section>
        <h2 className="text-xl font-bold border-b border-gray-300 pb-2 mb-4 uppercase text-gray-500 tracking-wider">Locations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border-l-4 border-black pl-4">
            <h3 className="font-bold text-lg mb-2 flex items-center"><MapPin className="mr-2 h-5 w-5" /> Origin</h3>
            {origin ? (
              <div className="space-y-1 text-lg">
                <p>{origin.street_1}</p>
                {origin.street_2 && <p>{origin.street_2}</p>}
                <p>{origin.city}, {origin.state} {origin.postal_code}</p>
                {origin.access_notes && (
                  <div className="mt-3 p-3 bg-gray-100 rounded text-base border border-gray-200">
                    <strong>Access:</strong> {origin.access_notes}
                  </div>
                )}
              </div>
            ) : (
              <p className="italic text-gray-500">No origin provided.</p>
            )}
          </div>

          <div className="border-l-4 border-black pl-4">
            <h3 className="font-bold text-lg mb-2 flex items-center"><MapPin className="mr-2 h-5 w-5" /> Destination</h3>
            {dest ? (
              <div className="space-y-1 text-lg">
                <p>{dest.street_1}</p>
                {dest.street_2 && <p>{dest.street_2}</p>}
                <p>{dest.city}, {dest.state} {dest.postal_code}</p>
                {dest.access_notes && (
                  <div className="mt-3 p-3 bg-gray-100 rounded text-base border border-gray-200">
                    <strong>Access:</strong> {dest.access_notes}
                  </div>
                )}
              </div>
            ) : (
              <p className="italic text-gray-500">No destination provided.</p>
            )}
          </div>
        </div>
      </section>

      {/* Inventory Snapshot */}
      <section>
        <div className="flex justify-between items-baseline border-b border-gray-300 pb-2 mb-4">
          <h2 className="text-xl font-bold uppercase text-gray-500 tracking-wider">Inventory to Move</h2>
          <p className="font-bold text-lg">{quote?.total_volume || 0} Total Cubic Ft</p>
        </div>
        
        {inventory.length > 0 ? (
          <table className="w-full text-left text-lg">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2">Item</th>
                <th className="py-2">Room</th>
                <th className="py-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventory.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="py-3 font-medium">{inv.inventory_item?.name || 'Unknown Item'}</td>
                  <td className="py-3 text-gray-600">{inv.inventory_item?.room || 'Unassigned'}</td>
                  <td className="py-3 text-right font-bold">{inv.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="italic text-gray-500">No inventory logged for this job.</p>
        )}
      </section>

      {/* Notes Section (For Crew to write on if printed) */}
      <section className="pt-8">
         <h2 className="text-xl font-bold border-b border-gray-300 pb-2 mb-4 uppercase text-gray-500 tracking-wider">Crew Notes / Sign-off</h2>
         <div className="border-2 border-gray-200 rounded-lg h-48 w-full mt-4 p-4 text-gray-400 italic">
           Any exceptions, damages, or notes should be recorded here...
         </div>
      </section>

    </div>
  )
}
