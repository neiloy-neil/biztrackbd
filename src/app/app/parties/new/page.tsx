'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createParty } from '@/domains/parties/actions'

export default function NewPartyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const type = formData.get('type') as 'customer' | 'supplier'
    const name = formData.get('name') as string
    const phone = formData.get('phone') as string
    const address = formData.get('address') as string
    
    // For opening balance:
    // If it's a customer, positive balance means they owe us (পাবো), negative means they gave advance (দিতে হবে)
    // If it's a supplier, positive balance means we owe them (দিতে হবে), negative means we gave advance (পাবো)
    const balanceAmount = Number(formData.get('balance_amount') || 0)
    const balanceType = formData.get('balance_type') as 'due' | 'advance'
    
    let opening_balance = 0
    if (balanceAmount > 0) {
      if (type === 'customer') {
        opening_balance = balanceType === 'due' ? balanceAmount : -balanceAmount
      } else {
        // supplier
        opening_balance = balanceType === 'due' ? balanceAmount : -balanceAmount
      }
    }

    const credit_limit = Number(formData.get('credit_limit') || 0)

    const res = await createParty({
      type,
      name,
      phone,
      address,
      opening_balance,
      credit_limit
    })

    if (res.success) {
      router.push(`/app/parties/${(res.data as any).id}`)
    } else {
      setError(res.error || 'পার্টি তৈরি করা যায়নি')
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 pb-24 bg-[#FAFAFA] min-h-screen">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">নতুন পার্টি যোগ করুন</h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label>পার্টির ধরন</Label>
              <RadioGroup defaultValue="customer" name="type" className="flex gap-4">
                <div className="flex items-center space-x-2 border rounded-md p-3 flex-1 cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value="customer" id="customer" />
                  <Label htmlFor="customer" className="cursor-pointer flex-1">কাস্টমার</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-3 flex-1 cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value="supplier" id="supplier" />
                  <Label htmlFor="supplier" className="cursor-pointer flex-1">সাপ্লায়ার</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">নাম <span className="text-red-500">*</span></Label>
              <Input id="name" name="name" required placeholder="পার্টির নাম" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">মোবাইল নাম্বার</Label>
              <Input id="phone" name="phone" type="tel" placeholder="01XXXXXXXXX" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">ঠিকানা</Label>
              <Textarea id="address" name="address" placeholder="সম্পূর্ণ ঠিকানা" rows={2} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit_limit">বাকির সীমা (Credit Limit)</Label>
              <Input id="credit_limit" name="credit_limit" type="number" min="0" step="1" placeholder="0 (সীমা না থাকলে 0 দিন)" />
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold text-slate-900">পূর্বের হিসাব (Opening Balance)</h3>
              
              <div className="space-y-2">
                <Label htmlFor="balance_amount">টাকার পরিমাণ</Label>
                <Input id="balance_amount" name="balance_amount" type="number" min="0" step="1" placeholder="0" />
              </div>

              <RadioGroup defaultValue="due" name="balance_type" className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="due" id="due" />
                  <Label htmlFor="due" className="cursor-pointer">বাকি আছে (পাবো/দিতে হবে)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="advance" id="advance" />
                  <Label htmlFor="advance" className="cursor-pointer">অগ্রিম (Advance)</Label>
                </div>
              </RadioGroup>
            </div>

            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

            <Button type="submit" className="w-full bg-[#007AFF] hover:bg-[#005bb5]" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'সংরক্ষণ করা হচ্ছে...' : 'সংরক্ষণ করুন'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
