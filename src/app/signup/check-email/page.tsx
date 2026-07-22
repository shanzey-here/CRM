import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 relative overflow-hidden">
      
      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md flex flex-col items-center gap-8 relative z-10">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3 font-bold text-2xl tracking-tight">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
              <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
              <path d="M12 3v6"/>
            </svg>
          </div>
          Gomove CRM
        </div>
        
        <Card className="w-full shadow-lg border-muted/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-center">
          <CardHeader className="space-y-4 pt-8">
            <div className="mx-auto bg-green-100 dark:bg-green-900/30 p-3 rounded-full w-16 h-16 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Check your email</CardTitle>
            <CardDescription className="text-base pb-4">
              We've sent a verification link to your email address. 
              Click the link to activate your workspace and log in automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Return to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
