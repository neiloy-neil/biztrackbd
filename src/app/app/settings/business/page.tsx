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
import { createClient } from '@/lib/supabase/client'

const BUSINESS_TYPES = [
  'রিটেইল (Retail)',
  'হোলসেল (Wholesale)',
  'ম্যানুফ্যাকচারিং (Manufacturing)',
  'সার্ভিস (Service)',
  'রেস্তোরাঁ (Restaurant)',
  'ফার্মেসি (Pharmacy)',
  'গ্রোসারি (Grocery)',
  'ক্লথিং (Clothing)',
  'ইলেকট্রনিক্স (Electronics)',
  'অন্যান্য (Other)',
]

const BD_DISTRICTS = [
  'ঢাকা','চট্টগ্রাম','রাজশাহী','খুলনা','বরিশাল','সিলেট','রংপুর','ময়মনসিংহ',
  'গাজীপুর','নারায়ণগঞ্জ','কুমিল্লা','ফেনী','নোয়াখালী','লক্ষ্মীপুর','চাঁদপুর',
  'ব্রাহ্মণবাড়িয়া','হবিগঞ্জ','মৌলভীবাজার','সুনামগঞ্জ','নেত্রকোণা','কিশোরগঞ্জ',
  'টাঙ্গাইল','মানিকগঞ্জ','মুন্সীগঞ্জ','নরসিংদী','শরীয়তপুর','মাদারীপুর','গোপালগঞ্জ',
  'ফরিদপুর','রাজবাড়ী','পাবনা','সিরাজগঞ্জ','বগুড়া','নওগাঁ','জয়পুরহাট','নাটোর',
  'চাঁপাইনবাবগঞ্জ','কুষ্টিয়া','মেহেরপুর','চুয়াডাঙ্গা','ঝিনাইদহ','মাগুরা','নড়াইল',
  'সাতক্ষীরা','যশোর','বাগেরহাট','পিরোজপুর','ঝালকাঠি','পটুয়াখালী','বরগুনা','ভোলা',
  'ঠাকুরগাঁও','পঞ্চগড়','দিনাজপুর','নীলফামারী','লালমনিরহাট','কুড়িগ্রাম','গাইবান্ধা',
  'জামালপুর','শেরপুর','কক্সবাজার','বান্দরবান','রাঙামাটি','খাগড়াছড়ি',
]

type BusinessData = {
  name: string
  phone: string
  address: string
  district: string
  business_type: string
  trade_license: string
  logo_url: string
}

const empty: BusinessData = {
  name: '', phone: '', address: '', district: '',
  business_type: '', trade_license: '', logo_url: '',
}

export default function BusinessSettingsPage() {
  const [form, setForm] = useState<BusinessData>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    getBusinessProfile()
      .then(res => {
        if (res?.success && res.data) {
          const d = res.data as any
          setForm({
            name: d.name ?? '',
            phone: d.phone ?? '',
            address: d.address ?? '',
            district: d.district ?? '',
            business_type: d.business_type ?? '',
            trade_license: d.trade_license ?? '',
            logo_url: d.logo_url ?? '',
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof BusinessData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('লোগোর সাইজ ২ মেগাবাইটের কম হতে হবে')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    
    try {
      const { data, error } = await supabase.storage
        .from('business-logos')
        .upload(fileName, file, { upsert: true })
        
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage
        .from('business-logos')
        .getPublicUrl(fileName)
        
      setForm(f => ({ ...f, logo_url: publicUrl }))
      toast.success('লোগো আপলোড হয়েছে')
    } catch (err: any) {
      toast.error(err.message || 'লোগো আপলোড ব্যর্থ হয়েছে')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const res = await updateBusinessProfile(form)
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
    <div className="flex-1 p-4 md:p-8 pt-6 pb-24 bg-slate-50 min-h-screen">
      <div className="flex items-center gap-3 mb-6 max-w-xl mx-auto">
        <Link href="/app/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">ব্যবসার সেটিংস</h2>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-4">
        {/* Basic Info */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Store className="w-4 h-4 text-slate-500" />
              মূল তথ্য
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>ব্যবসার নাম <span className="text-rose-500">*</span></Label>
              <Input value={form.name} onChange={set('name')} placeholder="যেমন: রহিম স্টোর" required />
            </div>

            <div className="space-y-1.5">
              <Label>ব্যবসার লোগো (Business Logo)</Label>
              <div className="flex items-center gap-4">
                {form.logo_url && (
                  <img src={form.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-lg border bg-slate-50" />
                )}
                <div className="flex-1">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoUpload} 
                    disabled={uploading}
                    className="text-sm file:bg-emerald-50 file:text-emerald-700 file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-4 file:font-medium file:cursor-pointer cursor-pointer hover:file:bg-emerald-100"
                  />
                  {uploading && <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> আপলোড হচ্ছে...</p>}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>ব্যবসার ধরন</Label>
              <select
                value={form.business_type}
                onChange={set('business_type')}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">বেছে নিন...</option>
                {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>ফোন নম্বর</Label>
              <Input value={form.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" type="tel" />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800">ঠিকানা</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>বিস্তারিত ঠিকানা</Label>
              <textarea
                value={form.address}
                onChange={set('address')}
                rows={2}
                placeholder="রোড, এলাকা, উপজেলা..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>জেলা</Label>
              <select
                value={form.district}
                onChange={set('district')}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">জেলা বেছে নিন</option>
                {BD_DISTRICTS.map((d, i) => <option key={`${d}-${i}`} value={d}>{d}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Legal */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800">আইনি তথ্য</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>ট্রেড লাইসেন্স নম্বর</Label>
              <Input value={form.trade_license} onChange={set('trade_license')} placeholder="TL-XXXXXXXX" />
            </div>
          </CardContent>
        </Card>

        {saved && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            সফলভাবে সেভ হয়েছে!
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={saving || !form.name.trim()}
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          সেভ করুন
        </Button>
      </form>
    </div>
  )
}
