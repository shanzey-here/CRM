'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createTenantSchema, type CreateTenantInput } from '@/modules/tenants/schemas'
import { createTenant } from '../actions'
import { Plus, X, Loader2, Check, Copy } from 'lucide-react'

export function CreateTenantDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null)

  const [successData, setSuccessData] = useState<{
    tenantName: string
    adminEmail: string
    generatedPassword?: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      name: '',
      slug: '',
      adminFullName: '',
      adminEmail: '',
    },
  })

  // Track if user has manually edited slug to avoid overwriting intentional slug edits
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)

  function resetState() {
    setIsOpen(false)
    setIsLoading(false)
    setServerError(null)
    setSuccessData(null)
    setSlugManuallyEdited(false)
    reset()
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value
    setValue('name', newName, { shouldValidate: true })

    if (!slugManuallyEdited) {
      const generatedSlug = newName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setValue('slug', generatedSlug, { shouldValidate: !!generatedSlug })
    }
  }

  async function onSubmit(data: CreateTenantInput) {
    setIsLoading(true)
    setServerError(null)

    try {
      const result = await createTenant(data)

      if (result?.error) {
        setServerError(result.error)
      } else if (result?.success) {
        setSuccessData({
          tenantName: data.name,
          adminEmail: data.adminEmail,
          generatedPassword: result.generatedPassword,
        })
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  async function copyToClipboard(text: string, field: 'email' | 'password') {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
      >
        <Plus size={18} />
        Create Tenant
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 text-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">
                {successData ? 'Tenant Created Successfully' : 'Create New Tenant'}
              </h2>
              <button
                onClick={resetState}
                className="text-slate-400 hover:text-slate-900 transition-colors"
                title="Close dialog"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            {successData ? (
              <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
                  Workspace <strong className="font-semibold text-blue-900">{successData.tenantName}</strong> has been provisioned.
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    A first admin user has been created. They can sign in at <strong className="font-semibold text-slate-900">/login</strong> to access their workspace:
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm space-y-2.5">
                    <div className="flex justify-between items-center group">
                      <span className="text-slate-500 font-sans text-xs">Sign-In URL:</span>
                      <div className="flex items-center gap-2">
                        <a href="/login" target="_blank" rel="noreferrer" className="text-blue-600 underline font-sans text-xs hover:text-blue-800">
                          /login
                        </a>
                      </div>
                    </div>
                    <div className="flex justify-between items-center group">
                      <span className="text-slate-500 font-sans text-xs">Email:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 font-semibold">{successData.adminEmail}</span>
                        <button
                          onClick={() => copyToClipboard(successData.adminEmail, 'email')}
                          className="p-1 text-slate-400 hover:text-slate-900 transition-all bg-white shadow-sm border border-slate-200 rounded"
                          title="Copy admin email"
                          aria-label="Copy admin email"
                        >
                          {copiedField === 'email' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center group">
                      <span className="text-slate-500 font-sans text-xs">Temp Password:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-bold">{successData.generatedPassword}</span>
                        <button
                          onClick={() => copyToClipboard(successData.generatedPassword || '', 'password')}
                          className="p-1 text-slate-400 hover:text-slate-900 transition-all bg-white shadow-sm border border-slate-200 rounded"
                          title="Copy admin password"
                          aria-label="Copy admin password"
                        >
                          {copiedField === 'password' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Signing in with these credentials will automatically route the user to their workspace at <strong>/office</strong>.
                  </p>
                </div>

                <button
                  onClick={resetState}
                  className="w-full bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Workspace Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('name')}
                    onChange={handleNameChange}
                    placeholder="e.g. Acme Removals"
                    className={`w-full bg-white border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-slate-900 ${
                      errors.name ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Workspace Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('slug')}
                    onChange={(e) => {
                      setSlugManuallyEdited(true)
                      register('slug').onChange(e)
                    }}
                    placeholder="e.g. acme-removals"
                    className={`w-full bg-white border rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-slate-900 ${
                      errors.slug ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Unique lowercase slug used for workspace identification and lead embed widgets.
                  </p>
                  {errors.slug && <p className="text-xs text-red-600 mt-1">{errors.slug.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    First Admin Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('adminFullName')}
                    placeholder="e.g. Shanzey Shafique"
                    className={`w-full bg-white border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-slate-900 ${
                      errors.adminFullName ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  {errors.adminFullName && (
                    <p className="text-xs text-red-600 mt-1">{errors.adminFullName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    First Admin Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register('adminEmail')}
                    type="email"
                    placeholder="admin@acme.com"
                    className={`w-full bg-white border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-slate-900 ${
                      errors.adminEmail ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    A temporary password will be generated for this user.
                  </p>
                  {errors.adminEmail && (
                    <p className="text-xs text-red-600 mt-1">{errors.adminEmail.message}</p>
                  )}
                </div>

                {serverError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm">
                    {serverError}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetState}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {isLoading && <Loader2 size={16} className="animate-spin" />}
                    Create Workspace
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
