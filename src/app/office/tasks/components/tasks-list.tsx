'use client'

import { useState, useTransition } from 'react'
import { Task } from '@/modules/tasks/server/repository'
import { TenantUser } from '@/modules/users/server/repository'
import { updateTaskStatusAction } from '../actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock, Calendar, AlertCircle } from 'lucide-react'

interface TasksListProps {
  tasks: Task[]
  tenantStaff: TenantUser[]
}

export function TasksList({ tasks, tenantStaff }: TasksListProps) {
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleComplete = (taskId: string) => {
    setLoadingId(taskId)
    startTransition(async () => {
      await updateTaskStatusAction(taskId, 'completed')
      setLoadingId(null)
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-50 text-red-700 border-red-200'
      case 'high': return 'bg-orange-50 text-orange-700 border-orange-200'
      case 'medium': return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'low': return 'bg-slate-50 text-slate-700 border-slate-200'
      default: return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 px-4 text-slate-500">
        <CheckCircle2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
        <p className="text-lg font-medium text-slate-900">All caught up!</p>
        <p className="text-sm">There are no active tasks at the moment.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((task) => {
        const assignee = tenantStaff.find(s => s.id === task.assigned_to)
        return (
          <li key={task.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4">
            <button
              onClick={() => handleComplete(task.id)}
              disabled={isPending && loadingId === task.id}
              className="mt-1 shrink-0 text-slate-300 hover:text-emerald-500 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-6 w-6" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-slate-900 truncate">{task.title}</h3>
                <Badge variant="outline" className={getPriorityColor(task.priority || 'medium')}>
                  {task.priority}
                </Badge>
              </div>
              {task.description && (
                <p className="text-sm text-slate-600 mb-3 line-clamp-2">{task.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <span className="font-medium">Assigned to:</span>
                  {assignee ? (
                    <span className="text-slate-900">{assignee.full_name || assignee.email}</span>
                  ) : (
                    <span className="text-amber-600 font-medium">Unassigned</span>
                  )}
                </div>
                {task.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className={new Date(task.due_date) < new Date() ? "text-red-600 font-medium" : ""}>
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {task.lead_id && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">Lead</span>
                )}
                {task.contact_id && !task.lead_id && (
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">Contact</span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
