export interface InvoicePlan {
  subtotal: number
  taxAmount: number
  total: number
  lineItems: {
    description: string
    quantity: number
    unit_price: number
    amount: number
    sort_order: number
  }[]
  depositSchedule: {
    description: string
    amount: number
    due_date: string
    status: 'paid'
  } | null
  balanceSchedule: {
    description: string
    amount: number
    due_date: string
    status: 'pending'
  }
}

export function computeInvoicePlan(
  quote: {
    subtotal: number
    surcharge_total: number
    total_price: number
    deposit_amount: number
  },
  moveDate: string,
  balanceDueDaysBeforeMove: number
): InvoicePlan {
  const lineItems: InvoicePlan['lineItems'] = [
    {
      description: 'Removals Service',
      quantity: 1,
      unit_price: quote.subtotal,
      amount: quote.subtotal,
      sort_order: 1,
    },
  ]

  if (quote.surcharge_total > 0) {
    lineItems.push({
      description: 'Surcharges',
      quantity: 1,
      unit_price: quote.surcharge_total,
      amount: quote.surcharge_total,
      sort_order: 2,
    })
  }

  const moveDateObj = new Date(moveDate + 'T00:00:00Z')
  const balanceDueDateObj = new Date(moveDateObj.getTime() - balanceDueDaysBeforeMove * 24 * 60 * 60 * 1000)
  const balanceDueDate = balanceDueDateObj.toISOString().split('T')[0]

  const deposit = quote.deposit_amount
  const hasDeposit = deposit > 0

  return {
    subtotal: quote.subtotal,
    taxAmount: 0,
    total: quote.total_price,
    lineItems,
    depositSchedule: hasDeposit
      ? {
          description: 'Deposit',
          amount: deposit,
          due_date: new Date().toISOString().split('T')[0],
          status: 'paid',
        }
      : null,
    balanceSchedule: hasDeposit
      ? {
          description: 'Balance',
          amount: quote.total_price - deposit,
          due_date: balanceDueDate,
          status: 'pending',
        }
      : {
          description: 'Total Balance',
          amount: quote.total_price,
          due_date: balanceDueDate,
          status: 'pending',
        },
  }
}
