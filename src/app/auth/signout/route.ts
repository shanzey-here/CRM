import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Check if a user's session exists
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await supabase.auth.signOut()
  }

  // Clear cache and redirect back to login page
  revalidatePath('/', 'layout')

  const url = new URL(request.url)
  return NextResponse.redirect(new URL('/login', url.origin), {
    status: 303, // Redirect after POST
  })
}
