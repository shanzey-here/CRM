// Kanban board stage configuration — shared between Kanban board and detail page
export const KANBAN_STAGES = [
  { id: 'inquiry', label: 'Inquiry', color: '#94a3b8' }, // Slate 400
  { id: 'survey_scheduled', label: 'Survey Scheduled', color: '#64748b' }, // Slate 500
  { id: 'quote_sent', label: 'Quote Sent', color: '#3b82f6' }, // Blue 500
  { id: 'follow_up', label: 'Follow Up', color: '#f59e0b' }, // Amber 500
  { id: 'confirmed_booking', label: 'Confirmed Booking', color: '#10b981' }, // Emerald 500
] as const
