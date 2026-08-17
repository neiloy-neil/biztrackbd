'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Store, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { getBusinessProfile, updateBusinessProfile } from '@/domains/settings/actions'

export default function BusinessSettingsPage() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getBusinessProfile()
      .then(res => {
        if (res?.success && res.data) setName((res.data as any).name ?? '')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const res = await updateBusinessProfile({ name })
    setSaving(false)
    if (res?.success) {
      setSaved(true)
      toast.success('ব্যবসার তথ্য আপডেট হয়েছে')
      setTimeout(() => setSaved(false), 3000)
    } else {
      toast.error(res?.error || 'আপডেট ব্যর্থ হয়েছে')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-3 mb-4 max-w-xl mx-auto">
        <Link href="/app/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">ব্যবসার সেটিংস</h2>
      </div>

      <div className="max-w-xl mx-auto">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Store className="w-4 h-4 text-slate-500" />
              ব্যবসার তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>ব্যবসার নাম</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="যেমন: রহিম স্টোর"
                  required
                />
              </div>

              {saved && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-4 w-4" />
                  সফলভাবে সেভ হয়েছে!
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={saving || !name.trim()}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                সেভ করুন
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
