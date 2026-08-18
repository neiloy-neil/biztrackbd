'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { checkUserExists, loginWithPin, loginWithEmail, sendOtp, verifyOtpAndCreateUser, resetPin } from '../actions'

type Step = 'phone' | 'login_pin' | 'otp' | 'create_pin' | 'forgot_otp' | 'reset_pin'
type LoginMode = 'phone' | 'email'

export function BusinessLoginForm() {
  const [mode, setMode] = useState<LoginMode>('phone')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [step, setStep] = useState<Step>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetOtp, setResetOtp] = useState('')
  const [newPin, setNewPin] = useState('')
  const [timer, setTimer] = useState(0)

  const router = useRouter()

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000)
    }
    return () => clearInterval(interval)
  }, [timer])

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number')
      setLoading(false)
      return
    }

    const { exists } = await checkUserExists(phone)
    
    if (exists) {
      setStep('login_pin')
      setLoading(false)
    } else {
      const res = await sendOtp(phone)
      if (!res.success) {
        setError(res.error || 'Failed to send OTP')
      } else {
        setStep('otp')
        setTimer(60)
      }
      setLoading(false)
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (pin.length < 6) {
      setError('PIN must be at least 6 digits')
      setLoading(false)
      return
    }

    const res = await loginWithPin(phone, pin)
    if (!res.success) {
      setError(res.error || 'Invalid PIN')
      setLoading(false)
    } else {
      router.push(res.redirectTo || '/dashboard')
    }
  }

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < 6) {
      setError('Please enter a valid 6-digit OTP')
      return
    }
    setError('')
    setStep('create_pin')
  }

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (pin.length < 6) {
      setError('PIN must be at least 6 digits')
      setLoading(false)
      return
    }

    const res = await verifyOtpAndCreateUser(phone, otp, pin)
    if (!res.success) {
      setError(res.error || 'Failed to verify OTP or create account')
      if (res.error?.includes('OTP')) {
        setStep('otp')
      }
      setLoading(false)
    } else {
      router.push(res.redirectTo || '/onboarding')
    }
  }

  const handleForgotPin = async () => {
    setLoading(true)
    setError('')
    const res = await sendOtp(phone)
    if (!res.success) {
      setError(res.error || 'Failed to send OTP')
    } else {
      setResetOtp('')
      setNewPin('')
      setStep('forgot_otp')
      setTimer(60)
    }
    setLoading(false)
  }

  const handleForgotOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (resetOtp.length < 6) {
      setError('Please enter a valid 6-digit OTP')
      return
    }
    setError('')
    setStep('reset_pin')
  }

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (newPin.length < 6) {
      setError('PIN must be at least 6 digits')
      setLoading(false)
      return
    }

    const res = await resetPin(phone, resetOtp, newPin)
    if (!res.success) {
      setError(res.error || 'Failed to reset PIN')
      if (res.error?.includes('OTP')) setStep('forgot_otp')
      setLoading(false)
    } else {
      router.push(res.redirectTo || '/dashboard')
    }
  }

  const handleResendOtp = async () => {
    setLoading(true)
    setError('')
    const res = await sendOtp(phone)
    if (!res.success) {
      setError(res.error || 'Failed to send OTP')
    } else {
      setTimer(60)
    }
    setLoading(false)
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await loginWithEmail(email, password)
    if (!res.success) {
      setError(res.error || 'লগইন ব্যর্থ হয়েছে।')
      setLoading(false)
    } else {
      router.push(res.redirectTo || '/app/dashboard')
    }
  }

  return (
    <div className="bg-white px-6 py-8 shadow-sm ring-1 ring-slate-900/5 sm:rounded-2xl border border-slate-100">

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
        <button
          type="button"
          onClick={() => { setMode('phone'); setError('') }}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'phone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          মোবাইল + পিন
        </button>
        <button
          type="button"
          onClick={() => { setMode('email'); setError('') }}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === 'email' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          ইমেইল + পাসওয়ার্ড
        </button>
      </div>

      {/* EMAIL LOGIN */}
      {mode === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700 font-medium">ইমেইল (Email)</Label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email_password" className="text-slate-700 font-medium">পাসওয়ার্ড (Password)</Label>
            <input
              id="email_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="flex h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
              {error}
            </div>
          )}
          <Button disabled={loading || !email || !password} type="submit" className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm">
            {loading ? 'লগইন হচ্ছে...' : 'লগইন করুন (Login)'}
          </Button>
        </form>
      )}

      {mode === 'phone' && (
      <div>
      {/* STEP 1: PHONE */}
      {step === 'phone' && (
        <form onSubmit={handlePhoneSubmit} className="space-y-6">
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
      )}

      {/* STEP 2: LOGIN PIN */}
      {mode === 'phone' && step === 'login_pin' && (
        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="login_pin" className="text-slate-700 font-medium">লগইন পিন দিন (Enter PIN)</Label>
            <Input 
              id="login_pin" 
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••" 
              required 
              autoFocus
              className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-xl text-center text-2xl tracking-widest font-bold"
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              Logging into <span className="font-semibold">+880 {phone}</span>.{' '}
              <button type="button" onClick={() => setStep('phone')} className="text-emerald-600 hover:underline">Change</button>
            </p>
          </div>
          
          {error && (
            <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
              {error}
            </div>
          )}
          
          <Button disabled={loading || pin.length < 6} type="submit" className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm">
            {loading ? 'লগইন হচ্ছে...' : 'লগইন করুন (Login)'}
          </Button>
          <button
            type="button"
            onClick={handleForgotPin}
            disabled={loading}
            className="w-full text-sm text-slate-500 hover:text-emerald-600 transition-colors pt-1"
          >
            পিন ভুলে গেছেন? (Forgot PIN?)
          </button>
        </form>
      )}

      {/* STEP 3: OTP */}
      {mode === 'phone' && step === 'otp' && (
        <form onSubmit={handleOtpSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-slate-700 font-medium">ওটিপি কোড (OTP Code)</Label>
            <Input 
              id="otp" 
              type="text"
              inputMode="numeric"
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
              এগিয়ে যান (Continue)
            </Button>
            <Button 
              type="button" 
              disabled={timer > 0 || loading} 
              onClick={handleResendOtp} 
              variant="outline" 
              className="w-full h-12 text-base font-medium text-slate-700 border-slate-300 hover:bg-slate-50 rounded-xl"
            >
              {timer > 0 ? `পুনরায় পাঠাতে পারবেন ${timer}s পর` : 'পুনরায় পাঠান (Resend OTP)'}
            </Button>
          </div>
        </form>
      )}

      {/* STEP 4: CREATE PIN */}
      {mode === 'phone' && step === 'create_pin' && (
        <form onSubmit={handleCreateAccountSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="create_pin" className="text-slate-700 font-medium">একটি ৬-ডিজিট পিন সেট করুন (Set new PIN)</Label>
            <Input 
              id="create_pin" 
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••" 
              required 
              autoFocus
              className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-xl text-center text-2xl tracking-widest font-bold"
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              This 6-digit PIN will be required for future logins.
            </p>
          </div>
          
          {error && (
            <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
              {error}
            </div>
          )}
          
          <Button disabled={loading || pin.length < 6} type="submit" className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm">
            {loading ? 'অ্যাকাউন্ট তৈরি হচ্ছে...' : 'অ্যাকাউন্ট তৈরি করুন (Create Account)'}
          </Button>
        </form>
      )}

      {/* STEP 5: FORGOT PIN — OTP VERIFY */}
      {mode === 'phone' && step === 'forgot_otp' && (
        <form onSubmit={handleForgotOtpSubmit} className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-slate-600 text-center">
              <span className="font-semibold">+880 {phone}</span>-এ একটি OTP পাঠানো হয়েছে।
            </p>
            <Label htmlFor="forgot_otp" className="text-slate-700 font-medium">OTP কোড দিন</Label>
            <Input
              id="forgot_otp"
              type="text"
              inputMode="numeric"
              value={resetOtp}
              onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              autoFocus
              className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-xl text-center text-2xl tracking-widest font-bold"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
              {error}
            </div>
          )}

          <div className="grid gap-3 pt-2">
            <Button disabled={loading || resetOtp.length < 6} type="submit" className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm">
              এগিয়ে যান (Continue)
            </Button>
            <Button
              type="button"
              disabled={timer > 0 || loading}
              onClick={handleForgotPin}
              variant="outline"
              className="w-full h-12 text-base font-medium text-slate-700 border-slate-300 hover:bg-slate-50 rounded-xl"
            >
              {timer > 0 ? `পুনরায় পাঠাতে পারবেন ${timer}s পর` : 'পুনরায় পাঠান (Resend OTP)'}
            </Button>
          </div>
        </form>
      )}

      {/* STEP 6: FORGOT PIN — NEW PIN */}
      {mode === 'phone' && step === 'reset_pin' && (
        <form onSubmit={handleResetPinSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="reset_pin" className="text-slate-700 font-medium">নতুন পিন সেট করুন (Set new PIN)</Label>
            <Input
              id="reset_pin"
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              required
              autoFocus
              className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-emerald-500 rounded-xl text-center text-2xl tracking-widest font-bold"
            />
            <p className="text-xs text-slate-500 mt-2 text-center">
              নতুন ৬-ডিজিটের পিন দিন। পরের বার এই পিন দিয়ে লগইন করবেন।
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 border border-rose-200">
              {error}
            </div>
          )}

          <Button disabled={loading || newPin.length < 6} type="submit" className="w-full h-12 text-base font-bold bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm">
            {loading ? 'পিন পরিবর্তন হচ্ছে...' : 'পিন পরিবর্তন করুন (Reset PIN)'}
          </Button>
        </form>
      )}
      </div>
      )}
    </div>
  )
}
