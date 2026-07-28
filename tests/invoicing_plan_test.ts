import { computeInvoicePlan } from '../src/modules/invoicing/server/plan'

console.log('=== Invoicing Plan Unit Tests ===\n')

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passed++
  } catch (err: any) {
    console.error(`✗ ${name}`)
    console.error(`  ${err.message}`)
    failed++
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`)
  }
}

// Test 1: Basic quote with deposit
test('Basic quote with deposit splits into deposit (paid) and balance (pending)', () => {
  const plan = computeInvoicePlan(
    { subtotal: 1000, surcharge_total: 200, total_price: 1200, deposit_amount: 300 },
    '2026-08-15',
    2
  )

  assertEqual(plan.subtotal, 1000, 'Subtotal')
  assertEqual(plan.total, 1200, 'Total')
  assertEqual(plan.taxAmount, 0, 'Tax amount')

  assert(plan.lineItems.length === 2, 'Should have 2 line items (service + surcharge)')
  assertEqual(plan.lineItems[0].description, 'Removals Service', 'First line item')
  assertEqual(plan.lineItems[0].amount, 1000, 'Service amount')
  assertEqual(plan.lineItems[1].description, 'Surcharges', 'Second line item')
  assertEqual(plan.lineItems[1].amount, 200, 'Surcharge amount')

  assert(plan.depositSchedule !== null, 'Should have deposit schedule')
  assertEqual(plan.depositSchedule!.description, 'Deposit', 'Deposit description')
  assertEqual(plan.depositSchedule!.amount, 300, 'Deposit amount')
  assertEqual(plan.depositSchedule!.status, 'paid', 'Deposit status is paid')

  assertEqual(plan.balanceSchedule.description, 'Balance', 'Balance description')
  assertEqual(plan.balanceSchedule.amount, 900, 'Balance amount = total - deposit')
  assertEqual(plan.balanceSchedule.status, 'pending', 'Balance status is pending')
})

// Test 2: Quote without deposit
test('Quote without deposit creates single "Total Balance" schedule', () => {
  const plan = computeInvoicePlan(
    { subtotal: 1000, surcharge_total: 0, total_price: 1000, deposit_amount: 0 },
    '2026-08-15',
    2
  )

  assert(plan.depositSchedule === null, 'Should have no deposit schedule')
  assertEqual(plan.balanceSchedule.description, 'Total Balance', 'No deposit: single balance label')
  assertEqual(plan.balanceSchedule.amount, 1000, 'Balance = full total')
  assertEqual(plan.balanceSchedule.status, 'pending', 'Balance status is pending')

  assert(plan.lineItems.length === 1, 'Should have 1 line item only (service)')
  assertEqual(plan.lineItems[0].description, 'Removals Service', 'Only service line item')
})

// Test 3: Quote with zero surcharge
test('Quote with zero surcharge omits surcharge line item', () => {
  const plan = computeInvoicePlan(
    { subtotal: 2000, surcharge_total: 0, total_price: 2000, deposit_amount: 500 },
    '2026-08-15',
    2
  )

  assert(plan.lineItems.length === 1, 'Should have 1 line item (service only)')
  assertEqual(plan.lineItems[0].description, 'Removals Service', 'Only service line item')
})

// Test 4: Balance due date math
test('Balance due date is calculated as move_date minus balance_due_days_before_move', () => {
  const plan = computeInvoicePlan(
    { subtotal: 1000, surcharge_total: 0, total_price: 1000, deposit_amount: 0 },
    '2026-08-15', // ISO date
    2 // 2 days before move
  )

  // Move date: 2026-08-15
  // Balance due: 2026-08-13 (2 days before)
  assertEqual(plan.balanceSchedule.due_date, '2026-08-13', 'Balance due 2 days before move')
})

// Test 5: Different balance due offset
test('Balance due date respects different offset values', () => {
  const plan = computeInvoicePlan(
    { subtotal: 1000, surcharge_total: 0, total_price: 1000, deposit_amount: 0 },
    '2026-09-01', // Sep 1
    5 // 5 days before move
  )

  // Move date: 2026-09-01
  // Balance due: 2026-08-27 (5 days before)
  assertEqual(plan.balanceSchedule.due_date, '2026-08-27', 'Balance due 5 days before move')
})

// Test 6: Deposit schedule has today's date as due date
test('Deposit schedule has today as due date', () => {
  const today = new Date().toISOString().split('T')[0]

  const plan = computeInvoicePlan(
    { subtotal: 1000, surcharge_total: 0, total_price: 1000, deposit_amount: 250 },
    '2026-08-15',
    2
  )

  assert(plan.depositSchedule !== null, 'Should have deposit schedule')
  assertEqual(plan.depositSchedule!.due_date, today, 'Deposit due today')
})

// Test 7: Line item order is preserved
test('Line item sort_order increments correctly', () => {
  const plan = computeInvoicePlan(
    { subtotal: 1000, surcharge_total: 200, total_price: 1200, deposit_amount: 0 },
    '2026-08-15',
    2
  )

  assertEqual(plan.lineItems[0].sort_order, 1, 'Service has sort_order 1')
  assertEqual(plan.lineItems[1].sort_order, 2, 'Surcharge has sort_order 2')
})

console.log(`\n=== Results ===`)
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)

if (failed > 0) {
  process.exit(1)
}
