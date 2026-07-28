'use client'

import { useState, useTransition } from 'react'
import { createCheckoutSessionAction, createPortalSessionAction } from '../actions'
import { Loader2, ExternalLink } from 'lucide-react'

type SaasPrice = {
  id: string
  stripe_price_id: string
  unit_amount: number | null
  currency: string | null
  interval: 'month' | 'year' | null
  is_active: boolean | null
}

type SaasPlan = {
  id: string
  name: string
  description: string | null
  saas_prices: SaasPrice[]
}

type TenantSubscription = {
  status: string
  manually_suspended?: boolean | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  saas_prices: {
    unit_amount: number | null
    currency: string | null
    interval: string | null
    saas_plans: { name: string } | null
  } | null
} | null

function formatMoney(amount: number | null, currency: string | null) {
  if (amount === null) return '—'
  // saas_prices.currency defaults to 'usd' at the DB level (migration 00037);
  // null is defensive only, matching that same default.
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: (currency ?? 'usd').toUpperCase() }).format(amount / 100)
}

function StatusBadge({ status, manuallySuspended }: { status: string, manuallySuspended?: boolean | null }) {
  if (manuallySuspended) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
        suspended (manual)
      </span>
    )
  }
  const styles: Record<string, string> = {
    trialing: 'bg-blue-50 text-blue-700 border-blue-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    past_due: 'bg-amber-50 text-amber-700 border-amber-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.cancelled}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export function BillingPanel({
  subscription,
  plans,
}: {
  subscription: TenantSubscription
  plans: SaasPlan[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const isActivelyPaid = subscription?.status === 'active'
  const isManuallySuspended = !!subscription?.manually_suspended

  function handleCheckout(priceId: string) {
    setError(null)
    setLoadingAction(priceId)
    startTransition(async () => {
      const result = await createCheckoutSessionAction(priceId)
      if ('error' in result) {
        setError(result.error)
        setLoadingAction(null)
      } else {
        window.location.href = result.url
      }
    })
  }

  function handlePortal() {
    setError(null)
    setLoadingAction('portal')
    startTransition(async () => {
      const result = await createPortalSessionAction()
      if ('error' in result) {
        setError(result.error)
        setLoadingAction(null)
      } else {
        window.location.href = result.url
      }
    })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {isManuallySuspended && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm font-medium">
          Your account has been suspended by a platform administrator. Please contact support.
        </div>
      )}

      {/* Current subscription */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Current Plan</h3>

        {subscription ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <StatusBadge status={subscription.status} manuallySuspended={subscription.manually_suspended} />
              {subscription.saas_prices?.saas_plans?.name && (
                <span className="text-sm font-medium text-slate-900">
                  {subscription.saas_prices.saas_plans.name}
                </span>
              )}
            </div>

            {subscription.saas_prices && (
              <p className="text-sm text-slate-600">
                {formatMoney(subscription.saas_prices.unit_amount, subscription.saas_prices.currency)}
                {' / '}
                {subscription.saas_prices.interval}
              </p>
            )}

            {subscription.current_period_end && (
              <p className="text-sm text-slate-500">
                {subscription.cancel_at_period_end ? 'Access ends' : 'Renews'} on{' '}
                {new Date(subscription.current_period_end).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No subscription found.</p>
        )}

        {!isManuallySuspended && (
          <button
            onClick={handlePortal}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loadingAction === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Manage Billing
          </button>
        )}
      </div>

      {/* Plan picker — shown whenever the tenant isn't on an active paid plan */}
      {!isActivelyPaid && !isManuallySuspended && plans.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Choose a Plan</h3>
          <div className="space-y-3">
            {plans.map((plan) => (
              <div key={plan.id} className="border border-slate-200 rounded-lg p-4">
                <p className="font-medium text-slate-900">{plan.name}</p>
                {plan.description && <p className="text-sm text-slate-500 mt-0.5">{plan.description}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {plan.saas_prices?.filter((price) => price.is_active).map((price) => (
                    <button
                      key={price.id}
                      onClick={() => handleCheckout(price.stripe_price_id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {loadingAction === price.stripe_price_id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {formatMoney(price.unit_amount, price.currency)} / {price.interval}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
