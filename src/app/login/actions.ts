'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  let authError;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    authError = error;
  } catch (err: any) {
    console.error('[Login Action] Fatal network/fetch error:', err);
    return { error: 'Network timeout: Could not connect to the database. If you are using the Supabase free tier, your project may be paused. Please check your internet connection or Supabase dashboard.' }
  }

  if (authError) {
    console.error('[Login Action] Error:', authError.message, 'Email:', email)
    return { error: authError.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
