'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signup } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, type SignupInput } from '../schemas'

export function SignupForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: '',
      fullName: '',
      email: '',
      password: '',
      acceptTerms: false,
    },
  })

  // Watch for the checkbox state
  const acceptTerms = watch('acceptTerms')

  async function onSubmit(data: SignupInput) {
    setLoading(true)
    setError(null)
    const result = await signup(data)
    
    if (result.error) {
      if (result.error === 'account_exists') {
        setError('This email already has an account. Please log in.')
      } else {
        setError(result.error)
      }
      setLoading(false)
    } else {
      router.push('/signup/check-email')
    }
  }

  return (
    <Card className="w-full max-w-md shadow-lg border-muted/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">Create an account</CardTitle>
        <CardDescription>
          Sign up to create your Gomove CRM workspace.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="grid gap-4">
          {error && (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md border border-destructive/20 font-medium">
              {error}
            </div>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input 
              id="companyName" 
              placeholder="Acme Removals" 
              {...register('companyName')}
              className="bg-background"
            />
            {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input 
              id="fullName" 
              placeholder="John Doe" 
              {...register('fullName')}
              className="bg-background"
            />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="m@example.com" 
              {...register('email')}
              className="bg-background"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••"
              {...register('password')}
              className="bg-background"
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="acceptTerms" 
              checked={acceptTerms}
              onCheckedChange={(checked) => setValue('acceptTerms', checked as boolean, { shouldValidate: true })}
            />
            <label
              htmlFor="acceptTerms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I agree to the Terms of Service and Privacy Policy
            </label>
          </div>
          {errors.acceptTerms && <p className="text-sm text-destructive">{errors.acceptTerms.message}</p>}

        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button className="w-full font-semibold" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
          <div className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <a href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </a>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
