'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, ArrowUp, ArrowDown, AlertCircle, Save, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  WorkflowFormSchema,
  WorkflowFormValues,
  workflowTriggerEventTypes,
  workflowActionTypes,
  pipelineStages
} from '@/modules/workflows/schemas'
import { saveWorkflow } from '@/modules/workflows/server/actions'

interface Props {
  initialData?: WorkflowFormValues & { id?: string }
  isAiEmailEnabled: boolean
}

export function WorkflowBuilderForm({ initialData, isAiEmailEnabled }: Props) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [blockedByEntitlement, setBlockedByEntitlement] = useState(false)

  const defaultValues: WorkflowFormValues = initialData || {
    name: '',
    is_active: false,
    trigger_event_type: 'lead.created',
    trigger_conditions: [],
    actions: [{ action_type: 'create_task', action_config: { title: 'Follow up task' } }]
  }

  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(WorkflowFormSchema),
    defaultValues
  })

  const { fields: conditionFields, append: appendCondition, remove: removeCondition } = useFieldArray({
    control: form.control,
    name: 'trigger_conditions'
  })

  const { fields: actionFields, append: appendAction, remove: removeAction, swap: swapAction } = useFieldArray({
    control: form.control,
    name: 'actions'
  })

  const watchTriggerType = form.watch('trigger_event_type')
  const showEmailWarning = watchTriggerType === 'email.received' && isAiEmailEnabled

  async function onSubmit(data: WorkflowFormValues) {
    setIsSaving(true)
    setError(null)
    setBlockedByEntitlement(false)
    const result = await saveWorkflow(data, initialData?.id)
    setIsSaving(false)

    if (result.error) {
      if ('reason' in result && result.reason === 'entitlement') {
        setBlockedByEntitlement(true)
      } else {
        setError(result.error)
      }
    } else {
      router.push('/office/workflows')
      router.refresh()
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-4xl pb-24">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {blockedByEntitlement && (
        <Alert className="bg-indigo-50 border-indigo-200 text-indigo-900">
          <Lock className="h-4 w-4 text-indigo-600" />
          <AlertTitle>Upgrade to save this workflow</AlertTitle>
          <AlertDescription className="text-indigo-800">
            Your current plan doesn&apos;t include Automation Workflows. You can keep building and
            exploring this workflow freely — upgrading your plan is all that&apos;s needed to save
            and activate it.{' '}
            <Link href="/office/settings/billing" className="font-medium underline underline-offset-2">
              View plans
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Basic Settings */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold leading-6 text-slate-900">Workflow Settings</h3>
            <p className="mt-1 text-sm text-slate-500">Name and activate your workflow.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-6">
            <div className="sm:col-span-4">
              <Label htmlFor="name">Workflow Name</Label>
              <div className="mt-2">
                <Input id="name" {...form.register('name')} placeholder="e.g. Follow up on web leads" />
                {form.formState.errors.name && (
                  <p className="mt-2 text-sm text-red-600">{form.formState.errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="sm:col-span-6 flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex flex-col space-y-1">
                <Label htmlFor="is_active" className="text-base font-medium text-slate-900">
                  Active Status
                </Label>
              </div>
              <Switch
                id="is_active"
                checked={form.watch('is_active')}
                onCheckedChange={(c) => form.setValue('is_active', c)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trigger */}
      <div className="bg-white shadow sm:rounded-lg border-l-4 border-blue-500">
        <div className="px-4 py-5 sm:p-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold leading-6 text-slate-900">Trigger</h3>
            <p className="mt-1 text-sm text-slate-500">When should this workflow run?</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-6">
            <div className="sm:col-span-4">
              <Label>Event Type</Label>
              <div className="mt-2">
                <Select
                  value={watchTriggerType}
                  onValueChange={(val: any) => form.setValue('trigger_event_type', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflowTriggerEventTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.trigger_event_type && (
                  <p className="mt-2 text-sm text-red-600">{form.formState.errors.trigger_event_type.message}</p>
                )}
              </div>
            </div>
          </div>

          {showEmailWarning && (
            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">AI Assistant Interaction Warning</AlertTitle>
              <AlertDescription className="text-amber-700">
                You have AI Email Assistance enabled. This workflow will trigger independently of the AI assistant, which could result in overlapping automated behaviors (e.g. the AI drafting a response while the workflow simultaneously moves the stage).
              </AlertDescription>
            </Alert>
          )}

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <Label>Conditions (Optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => appendCondition({ field: '', value: '' })}>
                <Plus className="h-4 w-4 mr-2" /> Add Condition
              </Button>
            </div>
            
            {conditionFields.length === 0 && (
              <p className="text-sm text-slate-500 italic">No conditions. This workflow will run every time the event fires.</p>
            )}

            <div className="space-y-3">
              {conditionFields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-4 bg-slate-50 p-3 rounded-md">
                  <div className="flex-1">
                    <Input {...form.register(`trigger_conditions.${index}.field` as const)} placeholder="Field (e.g. source)" />
                  </div>
                  <span className="text-sm font-medium text-slate-500">equals</span>
                  <div className="flex-1">
                    <Input {...form.register(`trigger_conditions.${index}.value` as const)} placeholder="Value (e.g. website_form)" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeCondition(index)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white shadow sm:rounded-lg border-l-4 border-emerald-500">
        <div className="px-4 py-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold leading-6 text-slate-900">Actions</h3>
              <p className="mt-1 text-sm text-slate-500">What should happen? Actions run in order.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => appendAction({ action_type: 'create_task', action_config: { title: 'New Task' } })}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Action
            </Button>
          </div>

          <div className="space-y-4">
            {actionFields.map((field, index) => {
              const currentActionType = form.watch(`actions.${index}.action_type`)
              
              return (
                <div key={field.id} className="border border-slate-200 rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                        {index + 1}
                      </span>
                      <Select
                        value={currentActionType}
                        onValueChange={(val: any) => {
                          // Reset config shape when changing type
                          if (val === 'create_task') {
                            form.setValue(`actions.${index}`, { action_type: 'create_task', action_config: { title: '' } })
                          } else if (val === 'update_lead_stage') {
                            form.setValue(`actions.${index}`, { action_type: 'update_lead_stage', action_config: { stage: 'inquiry' } })
                          }
                        }}
                      >
                        <SelectTrigger className="w-[200px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {workflowActionTypes.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t === 'create_task' ? 'Create Task' : 'Update Lead Stage'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === 0}
                        onClick={() => swapAction(index, index - 1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={index === actionFields.length - 1}
                        onClick={() => swapAction(index, index + 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 ml-2"
                        onClick={() => removeAction(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="pl-9">
                    {currentActionType === 'create_task' && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="col-span-2 sm:col-span-1">
                          <Label>Task Title</Label>
                          <Input 
                            {...form.register(`actions.${index}.action_config.title` as const)} 
                            className="mt-1 bg-white" 
                            placeholder="e.g. Call customer"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <Label>Due Offset (Days)</Label>
                          <Input
                            type="number"
                            value={
                              (form.watch(`actions.${index}.action_config` as const) as any)?.due_offset_days ?? ''
                            }
                            onChange={(e) => {
                              const raw = e.target.value
                              form.setValue(
                                `actions.${index}.action_config.due_offset_days` as const,
                                raw === '' ? undefined : Number(raw)
                              )
                            }}
                            className="mt-1 bg-white"
                            placeholder="e.g. 2"
                          />
                          {form.formState.errors.actions?.[index] &&
                            'action_config' in form.formState.errors.actions[index]! &&
                            (form.formState.errors.actions[index] as any).action_config?.due_offset_days && (
                              <p className="mt-1 text-sm text-red-600">
                                {(form.formState.errors.actions[index] as any).action_config.due_offset_days.message}
                              </p>
                            )}
                        </div>
                      </div>
                    )}
                    
                    {currentActionType === 'update_lead_stage' && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="col-span-2 sm:col-span-1">
                          <Label>New Pipeline Stage</Label>
                          <Select
                            value={form.watch(`actions.${index}.action_config.stage`)}
                            onValueChange={(val: any) => form.setValue(`actions.${index}.action_config.stage`, val)}
                          >
                            <SelectTrigger className="mt-1 bg-white">
                              <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {pipelineStages.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            
            {form.formState.errors.actions?.message && (
              <p className="text-sm text-red-600">{form.formState.errors.actions.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Floating Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white border-t border-slate-200 p-4 px-8 flex justify-end gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => router.push('/office/workflows')}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Workflow
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
