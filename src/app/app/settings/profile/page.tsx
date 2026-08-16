'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, User, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<any>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/app/login'); return }
      setUser(user)
      setFormData({
        full_name: user.user_metadata?.full_name || '',
        phone: user.phone || '',
      })
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSaved(false)

    const { error } = await supabase.auth.updateUser({
      data: { full_name: formData.full_name }
    })

    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setLoading(false)
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-4 mb-4 max-w-xl mx-auto">
        <Link href="/app/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">প্রোফাইল</h2>
      </div>

      <div className="max-w-xl mx-auto space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center">
            <User className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-lg">
              {formData.full_name || 'নাম দেওয়া হয়নি'}
            </p>
            <p className="text-sm text-slate-500">{formData.phone}</p>
          </div>
        </div>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800">
              তথ্য আপডেট করুন
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>পূর্ণ নাম (Full Name)</Label>
                <Input
                  value={formData.full_name}
                  onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="আপনার নাম লিখুন"
                />
              </div>

              <div className="space-y-2">
                <Label>ফোন নম্বর (Phone)</Label>
                <Input
                  value={formData.phone}
                  disabled
                  className="bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400">ফোন নম্বর পরিবর্তন করা যাবে না।</p>
              </div>

              {error && <p className="text-sm text-rose-500">{error}</p>}

              {saved && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  প্রোফাইল সফলভাবে আপডেট হয়েছে!
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                সেভ করুন
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
