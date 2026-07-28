// Kanban board stage configuration — shared between Kanban board and detail page
export const KANBAN_STAGES = [
  { id: 'inquiry', label: 'Inquiry', color: '#6366f1' },
  { id: 'survey_scheduled', label: 'Survey Scheduled', color: '#f59e0b' },
  { id: 'quote_sent', label: 'Quote Sent', color: '#3b82f6' },
  { id: 'follow_up', label: 'Follow Up', color: '#ec4899' },
  { id: 'confirmed_booking', label: 'Confirmed Booking', color: '#10b981' },
] as const
