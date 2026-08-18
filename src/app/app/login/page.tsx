import { BusinessLoginForm } from '@/domains/auth/components/BusinessLoginForm'

export default async function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-sm border border-emerald-200">
            B
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">BizTrack BD</h2>
          <p className="mt-2 text-sm text-slate-600 font-medium">
            আপনার ব্যবসার সহজ হিসাব (10-Second Cashbook)
          </p>
        </div>
        
        <BusinessLoginForm />
      </div>
    </div>
  )
}
