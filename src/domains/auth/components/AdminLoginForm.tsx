'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginAdminWithEmail } from '../admin-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ShieldAlert } from 'lucide-react'

export function AdminLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await loginAdminWithEmail(email, password)
      if (res.success && res.redirectTo) {
        router.push(res.redirectTo)
      } else {
        setError(res.error || 'Invalid credentials')
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Admin Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@biztrackbd.com"
              className="mt-1 h-12 bg-slate-50 border-slate-200"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 h-12 bg-slate-50 border-slate-200"
              required
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 p-4 text-sm font-medium text-rose-800 flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full h-12 text-lg font-bold bg-slate-900 hover:bg-slate-800 text-white"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Secure Login'
          )}
        </Button>
      </form>
    </div>
  )
}
