'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createTaskAction } from '../tasks/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { TenantUser } from '@/modules/users/server/repository'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
})

type FormValues = z.input<typeof schema>

interface CreateTaskFormProps {
  contactId?: string
  leadId?: string
  tenantStaff: TenantUser[]
  onSuccess?: () => void
}

export function CreateTaskForm({ contactId, leadId, tenantStaff, onSuccess }: CreateTaskFormProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, setValue, watch, formState: { errors, isValid }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'medium',
      assigned_to: 'unassigned' // 'unassigned' string is sent to action, which interprets it as null
    }
  })

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      setServerError(null)
      const res = await createTaskAction({
        ...data,
        contact_id: contactId,
        lead_id: leadId
      })

      if (res.success) {
        reset()
        onSuccess?.()
      } else {
        setServerError(res.error || 'Failed to create task')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white p-4 rounded-lg border border-slate-200">
      <div className="space-y-2">
        <Label htmlFor="title">Task Title</Label>
        <Input id="title" {...register('title')} disabled={isPending} placeholder="What needs to be done?" />
        {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea id="description" {...register('description')} disabled={isPending} placeholder="Add details..." className="min-h-[80px]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="assigned_to">Assign To</Label>
          <Select 
            disabled={isPending} 
            value={watch('assigned_to')} 
            onValueChange={(val) => setValue('assigned_to', val || undefined)}
          >
            <SelectTrigger id="assigned_to">
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {tenantStaff.map(staff => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.full_name || staff.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select 
            disabled={isPending} 
            value={watch('priority')} 
            onValueChange={(val: any) => setValue('priority', val)}
          >
            <SelectTrigger id="priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="due_date">Due Date (Optional)</Label>
        <Input id="due_date" type="date" {...register('due_date')} disabled={isPending} />
      </div>

      {serverError && <p className="text-sm text-red-500">{serverError}</p>}
      
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending || !isValid}>
          {isPending ? 'Creating...' : 'Create Task'}
        </Button>
      </div>
    </form>
  )
}
