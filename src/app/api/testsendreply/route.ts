import { NextRequest, NextResponse } from 'next/server'
import { sendReplyAction } from '@/app/office/email/[threadId]/actions'

// TEMPORARY — proves the real, unmodified sendReplyAction works end-to-end
// (guard, DB reads, threading headers, real send, insert, 3-way result) via
// a real authenticated request. Deleted immediately after the verification run.
export async function POST(request: NextRequest) {
  const { threadId, body } = await request.json()
  const result = await sendReplyAction(threadId, body)
  return NextResponse.json(result)
}
