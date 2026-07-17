import { z } from 'zod'
import { InsertTaskInput } from '../src/modules/tasks/schemas'

console.log('--- Running Tasks UI Zod Boundaries Tests ---')

import { insertTaskSchema } from '../src/modules/tasks/schemas'
import crypto from 'crypto'

console.log('--- Running Tasks UI Zod Boundaries Tests ---')

const testContactId = crypto.randomUUID()
const testAssignedTo = crypto.randomUUID()

// 1. Valid payload
const valid = insertTaskSchema.safeParse({
  contact_id: testContactId,
  title: 'Test task',
  priority: 'high',
  assigned_to: testAssignedTo
})
if (!valid.success) throw new Error('Failed to parse valid payload: ' + JSON.stringify(valid.error.issues))
console.log('✅ Zod accepts valid payload')

// 2. Invalid missing title
const invalidTitle = insertTaskSchema.safeParse({
  contact_id: testContactId,
  priority: 'high',
})
if (invalidTitle.success) throw new Error('Zod accepted payload without title')
console.log('✅ Zod rejects missing title')

// 3. Invalid priority enum
const invalidPriority = insertTaskSchema.safeParse({
  contact_id: testContactId,
  title: 'Test',
  priority: 'super_urgent',
})
if (invalidPriority.success) throw new Error('Zod accepted invalid priority')
console.log('✅ Zod rejects invalid priority')

// 4. Invalid assigned_to UUID
const invalidAssigned = insertTaskSchema.safeParse({
  contact_id: testContactId,
  title: 'Test',
  assigned_to: 'not-a-uuid',
})
if (invalidAssigned.success) throw new Error('Zod accepted invalid assigned_to UUID')
console.log('✅ Zod rejects invalid assigned_to UUID')

console.log('✅ All Zod boundary tests passed.')
