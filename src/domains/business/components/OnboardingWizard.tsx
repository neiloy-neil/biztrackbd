'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { completeOnboarding } from '../actions'

const CATEGORIES = ['Retail', 'Pharmacy', 'Grocery', 'Services', 'Wholesale', 'Other']
const PAYMENT_OPTIONS = ['Cash', 'bKash', 'Nagad', 'Bank', 'Rocket']

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // State Machine Data
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Cash']) // Cash always default
  const [openingBalances, setOpeningBalances] = useState<Record<string, string>>({'Cash': '0'})

  const handleNext = () => setStep(s => s + 1)
  const handlePrev = () => setStep(s => s - 1)

  const togglePaymentMethod = (method: string) => {
    setPaymentMethods(prev => {
      if (prev.includes(method)) {
        if (method === 'Cash') return prev // Can't remove cash
        const newMethods = prev.filter(m => m !== method)
        const newBalances = { ...openingBalances }
        delete newBalances[method]
        setOpeningBalances(newBalances)
        return newMethods
      } else {
        setOpeningBalances(b => ({ ...b, [method]: '0' }))
        return [...prev, method]
      }
    })
  }

  const handleComplete = async () => {
    setLoading(true)
    setError('')
    
    // Format balances to numbers array matching the payment methods array
    const formattedBalances = paymentMethods.map(m => parseFloat(openingBalances[m] || '0'))

    const res = await completeOnboarding({
      businessName,
      category,
      ownerName,
      paymentMethods,
      openingBalances: formattedBalances
    })

    if (res.success) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setError(res.error || 'Failed to complete setup.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white shadow-sm ring-1 ring-slate-900/5 sm:rounded-2xl p-6 md:p-8">
      {/* Progress Bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5, 6].map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-emerald-500' : 'bg-slate-100'}`} />
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200 mb-6">
          {error}
        </div>
      )}

      {/* Step 1: Business Name */}
      {step === 1 && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">What's your business name?</h2>
            <p className="text-slate-500 mt-1">You can always change this later in settings.</p>
          </div>
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input 
              value={businessName} 
              onChange={e => setBusinessName(e.target.value)} 
              placeholder="e.g. Rahim Store"
              className="h-12 text-lg"
              autoFocus
            />
          </div>
          <Button onClick={handleNext} disabled={!businessName.trim()} className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700">Next</Button>
        </div>
      )}

      {/* Step 2: Category */}
      {step === 2 && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">What type of business?</h2>
            <p className="text-slate-500 mt-1">This helps us customize your experience.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map(cat => (
              <button 
                key={cat}
                onClick={() => setCategory(cat)}
                className={`h-14 rounded-xl border-2 font-medium transition-all ${category === cat ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={handlePrev} variant="outline" className="flex-1 h-12">Back</Button>
            <Button onClick={handleNext} disabled={!category} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700">Next</Button>
          </div>
        </div>
      )}

      {/* Step 3: Owner Name */}
      {step === 3 && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Who is the owner?</h2>
            <p className="text-slate-500 mt-1">Enter your full name.</p>
          </div>
          <div className="space-y-2">
            <Label>Owner Full Name</Label>
            <Input 
              value={ownerName} 
              onChange={e => setOwnerName(e.target.value)} 
              placeholder="e.g. Abdur Rahim"
              className="h-12 text-lg"
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={handlePrev} variant="outline" className="flex-1 h-12">Back</Button>
            <Button onClick={handleNext} disabled={!ownerName.trim()} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700">Next</Button>
          </div>
        </div>
      )}

      {/* Step 4: Payment Methods */}
      {step === 4 && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">How do you accept payments?</h2>
            <p className="text-slate-500 mt-1">Select all the accounts you use for the business.</p>
          </div>
          <div className="space-y-3">
            {PAYMENT_OPTIONS.map(method => (
              <label key={method} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethods.includes(method) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                  checked={paymentMethods.includes(method)}
                  disabled={method === 'Cash'}
                  onChange={() => togglePaymentMethod(method)}
                />
                <span className="font-medium text-slate-900 text-lg">{method}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={handlePrev} variant="outline" className="flex-1 h-12">Back</Button>
            <Button onClick={handleNext} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700">Next</Button>
          </div>
        </div>
      )}

      {/* Step 5: Opening Balances */}
      {step === 5 && (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Current Balances</h2>
            <p className="text-slate-500 mt-1">How much money is currently in these accounts?</p>
          </div>
          <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
            {paymentMethods.map(method => (
              <div key={method} className="space-y-2">
                <Label>{method} Balance (৳)</Label>
                <Input 
                  type="number"
                  min="0"
                  value={openingBalances[method] || ''} 
                  onChange={e => setOpeningBalances(b => ({ ...b, [method]: e.target.value }))} 
                  placeholder="0.00"
                  className="h-12 text-lg font-medium"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <Button onClick={handlePrev} variant="outline" className="flex-1 h-12">Back</Button>
            <Button onClick={handleNext} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700">Next</Button>
          </div>
        </div>
      )}

      {/* Step 6: Complete */}
      {step === 6 && (
        <div className="space-y-6 text-center animate-in zoom-in-95 fade-in duration-300">
          <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">All Set!</h2>
            <p className="text-slate-500 mt-2 text-lg">Your business ledger is ready.</p>
          </div>
          
          <div className="pt-8">
            <Button 
              onClick={handleComplete} 
              disabled={loading}
              className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? 'Setting up...' : 'Go to Dashboard'}
            </Button>
            <Button onClick={handlePrev} disabled={loading} variant="ghost" className="mt-4 text-slate-500">Wait, let me go back</Button>
          </div>
        </div>
      )}
    </div>
  )
}
