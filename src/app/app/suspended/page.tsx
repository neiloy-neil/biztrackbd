import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppLink as Link } from '@/components/AppLink'

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-10 text-center">
        <div className="flex items-center justify-center w-16 h-16 bg-amber-50 rounded-full mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          Account Suspended
        </h1>

        <p className="text-slate-500 leading-relaxed mb-8">
          Your business account has been suspended. This may be due to a billing issue
          or a policy violation. Please contact our support team to resolve this.
        </p>

        <div className="space-y-3">
          <Link href="/app/support/new">
            <Button className="w-full bg-[#007AFF] hover:bg-[#005bb5]">
              Contact Support
            </Button>
          </Link>
          <Link href="/app/settings/billing">
            <Button variant="outline" className="w-full">
              View Billing
            </Button>
          </Link>
        </div>

        <p className="text-xs text-slate-400 mt-8">
          If you believe this is a mistake, please reach out and we will resolve it promptly.
        </p>
      </div>
    </div>
  )
}
