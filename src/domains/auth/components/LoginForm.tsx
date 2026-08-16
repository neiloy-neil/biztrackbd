'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendOtp, verifyOtp } from '../actions'

export function LoginForm() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [timer, setTimer] = useState(0)
  const router = useRouter()

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000)
    }
    return () => clearInterval(interval)
  }, [timer])

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError('')
    
    // Validate phone briefly
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number')
      setLoading(false)
      return
    }

    const res = await sendOtp(phone)
    if (!res.success) {
      setError(res.error || 'Failed to send OTP')
    } else {
      setStep('otp')
      setTimer(60)
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await verifyOtp(phone, otp)
    if (!res.success) {
      setError(res.error || 'Invalid OTP')
      setLoading(false)
    } else {
      // Use server-determined redirect (onboarding for new users, dashboard for existing)
      router.push((res as any).redirectTo || '/dashboard')
    }
  }

  return (
    <div className="bg-white px-6 py-8 shadow-sm ring-1 ring-slate-900/5 sm:rounded-2xl border border-slate-100">
      {step === 'phone' ? (
        <form onSubmit={handleSendOtp} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-slate-700 font-medium">মোবাইল নম্বর (Mobile Number)</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">+880</span>
              <Input 
                id="phone" 
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="1700000000" 
                required 
                className="pl-14 h-12 bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-xl font-medium tracking-wide"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Provide your 10-digit number without the leading zero.</p>
          </div>
          
          {error && (
            <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
              {error}
            </div>
          )}
          
          <Button disabled={loading} type="submit" className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm">
            {loading ? 'অপেক্ষা করুন...' : 'এগিয়ে যান (Continue)'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-slate-700 font-medium">ওটিপি কোড (OTP Code)</Label>
            <Input 
              id="otp" 
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" 
              required 
              autoFocus
              className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-xl text-center text-2xl tracking-widest font-bold"
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              We sent a code to <span className="font-semibold">+880 {phone}</span>.{' '}
              <button type="button" onClick={() => setStep('phone')} className="text-emerald-600 hover:underline">Change</button>
            </p>
          </div>
          
          {error && (
            <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
              {error}
            </div>
          )}
          
          <div className="grid gap-3 pt-2">
            <Button disabled={loading || otp.length < 6} type="submit" className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm">
              {loading ? 'অপেক্ষা করুন...' : 'ভেরিফাই করুন (Verify)'}
            </Button>
            <Button 
              type="button" 
              disabled={timer > 0 || loading} 
              onClick={() => handleSendOtp()} 
              variant="outline" 
              className="w-full h-12 text-base font-medium text-slate-700 border-slate-300 hover:bg-slate-50 rounded-xl"
            >
              {timer > 0 ? `পুনরায় পাঠাতে পারবেন ${timer}s পর` : 'পুনরায় পাঠান (Resend OTP)'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
