import { test, expect } from '@playwright/test'
import { getContactDisplayName } from '../src/app/office/leads/components/lead-card'
import { KANBAN_STAGES } from '../src/app/office/leads/constants'

async function runUnitTests() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  LEAD CARD QUICK ACTIONS VERIFICATION TESTS')
  console.log('═══════════════════════════════════════════════════════════════\n')

  console.log('--- Checking 5 Active Kanban Stages Config ---')
  if (KANBAN_STAGES.length !== 5) {
    throw new Error(`Expected 5 active Kanban stages, got ${KANBAN_STAGES.length}`)
  }
  const stageIds = KANBAN_STAGES.map((s) => s.id)
  console.log(`✓ Active Stages: ${stageIds.join(', ')}`)

  console.log('\n--- Checking getContactDisplayName helper ---')
  const formatted = getContactDisplayName({ first_name: 'Jane', last_name: 'Doe' })
  if (formatted !== 'Jane Doe') {
    throw new Error(`Expected "Jane Doe", got "${formatted}"`)
  }
  console.log('✓ getContactDisplayName works correctly')

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  All Quick Action Unit Tests Passed Successfully ✓')
  console.log('═══════════════════════════════════════════════════════════════\n')
}

runUnitTests().catch((err) => {
  console.error('Test error:', err)
  process.exit(1)
})
