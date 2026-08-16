import { OnboardingWizard } from '@/domains/business/components/OnboardingWizard'

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Setup your ledger</h1>
        <p className="mt-3 text-lg text-slate-500">Let's configure your business in 6 easy steps.</p>
      </div>

      <OnboardingWizard />
    </div>
  )
}
