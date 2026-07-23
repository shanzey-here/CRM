import { Mail } from 'lucide-react'

export function ConnectGmailButton() {
  return (
    <a
      href="/api/oauth/gmail/start"
      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
    >
      <Mail className="h-4 w-4" />
      Connect Gmail
    </a>
  )
}
