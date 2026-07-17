'use client'

import { useState, useTransition } from 'react'
import { TimelineItem as TimelineItemType } from '@/modules/activities/server/repository'
import { addNoteAction } from './timeline-actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Timeline, TimelineItem, TimelineIcon, TimelineContent, TimelineTime, TimelineTitle, TimelineDescription } from '@/components/ui/timeline'
import { MessageSquare, RefreshCcw, CheckCircle2, User, FileEdit } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreateTaskForm } from './create-task-form'
import { TenantUser } from '@/modules/users/server/repository'

interface TimelineViewProps {
  items: TimelineItemType[]
  contactId?: string
  leadId?: string
  currentUserId: string
  tenantStaff: TenantUser[]
}

export function TimelineView({ items, contactId, leadId, currentUserId, tenantStaff }: TimelineViewProps) {
  const [noteContent, setNoteContent] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('note')

  const handleAddNote = () => {
    if (!noteContent.trim()) return

    startTransition(async () => {
      setError(null)
      const res = await addNoteAction({
        contact_id: contactId,
        lead_id: leadId,
        content: noteContent
      })

      if (res.success) {
        setNoteContent('')
      } else {
        setError(res.error || 'Failed to add note')
      }
    })
  }

  const getIcon = (item: TimelineItemType) => {
    if (item.type === 'task') return <CheckCircle2 className="w-3 h-3 text-emerald-600" />
    if (item.subType === 'note') return <MessageSquare className="w-3 h-3 text-blue-600" />
    if (item.subType === 'stage_change') return <RefreshCcw className="w-3 h-3 text-orange-600" />
    if (item.subType === 'system') return <FileEdit className="w-3 h-3 text-slate-600" />
    return <User className="w-3 h-3 text-slate-600" />
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="note">Add Note</TabsTrigger>
          <TabsTrigger value="task">Create Task</TabsTrigger>
        </TabsList>
        <TabsContent value="note">
          <div className="space-y-3 bg-slate-50/50 p-4 rounded-lg border border-slate-100">
            <Textarea 
              placeholder="Add a note to the timeline..." 
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="min-h-[80px] bg-white resize-none"
              disabled={isPending}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end">
              <Button 
                size="sm" 
                onClick={handleAddNote}
                disabled={!noteContent.trim() || isPending}
              >
                {isPending ? 'Saving...' : 'Add Note'}
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="task">
          <CreateTaskForm 
            contactId={contactId} 
            leadId={leadId} 
            tenantStaff={tenantStaff} 
            onSuccess={() => setActiveTab('note')}
          />
        </TabsContent>
      </Tabs>

      {/* Timeline */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
          No activity recorded yet
        </div>
      ) : (
        <Timeline>
          {items.map((item) => (
            <TimelineItem key={item.id}>
              <TimelineIcon>
                {getIcon(item)}
              </TimelineIcon>
              <TimelineContent>
                <TimelineTime>
                  {new Date(item.createdAt).toLocaleString(undefined, { 
                    dateStyle: 'medium', 
                    timeStyle: 'short' 
                  })}
                  {item.createdBy && ` • ${item.createdBy}`}
                </TimelineTime>
                <TimelineTitle className="capitalize text-slate-700">
                  {item.type === 'task' ? 'Task' : item.subType.replace('_', ' ')}
                  {item.type === 'task' && item.status && ` • ${item.status.replace('_', ' ')}`}
                </TimelineTitle>
                <TimelineDescription className="mt-1 text-slate-900">
                  {item.content}
                </TimelineDescription>
                {item.type === 'task' && item.assignedTo && (
                  <p className="text-xs text-slate-500 mt-1">Assigned to: {item.assignedTo}</p>
                )}
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}
    </div>
  )
}
