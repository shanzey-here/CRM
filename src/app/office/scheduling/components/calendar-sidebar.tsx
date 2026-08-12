'use client'

export function CalendarSidebar() {
  return (
    <div className="w-64 border-l bg-white p-4 hidden md:flex flex-col space-y-6 overflow-y-auto">
      <div>
        <h3 className="font-semibold text-sm mb-3">Manage View</h3>
        <div className="space-y-2 text-sm text-slate-700">
          <label className="flex items-center space-x-2">
            <input type="radio" name="view-type" defaultChecked className="text-blue-600" />
            <span>All</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="radio" name="view-type" className="text-blue-600" />
            <span>Jobs Only</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="radio" name="view-type" className="text-blue-600" />
            <span>Tasks Only</span>
          </label>
          <label className="flex items-center space-x-2">
            <input type="radio" name="view-type" className="text-blue-600" />
            <span>Appointments Only</span>
          </label>
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-3">Assigned Crew</h3>
        <div className="space-y-2 text-sm text-slate-700">
           {/* Checkboxes would be driven by actual crew members */}
           <label className="flex items-center space-x-2">
            <input type="checkbox" defaultChecked className="text-blue-600 rounded" />
            <span>Show All Crew</span>
          </label>
        </div>
      </div>
    </div>
  )
}
