import { AdminLoginForm } from '@/domains/auth/components/AdminLoginForm'

export default async function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-slate-900 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-sm border border-slate-800">
            A
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">BizTrack Admin</h2>
          <p className="mt-2 text-sm text-slate-600 font-medium">
            Platform Control Plane Login
          </p>
        </div>
        
        <AdminLoginForm />
      </div>
    </div>
  )
}
