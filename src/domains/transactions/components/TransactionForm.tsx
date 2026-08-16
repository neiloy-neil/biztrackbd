'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { createTransaction } from '@/domains/transactions/actions'

import { Check, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

const DEFAULT_INCOME_CATEGORIES = ['বিক্রি (Sale)', 'সার্ভিস (Service)', 'অন্যান্য আয়']
const DEFAULT_EXPENSE_CATEGORIES = ['বেতন (Salary)', 'ভাড়া (Rent)', 'যাতায়াত', 'বিবিধ খরচ', 'পণ্য ক্রয়']

export function TransactionForm({ accounts, parties, recentCategories }: { accounts: any[], parties: any[], recentCategories: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultType = searchParams.get('type') === 'expense' ? 'expense' : 'sale'
  
  const [type, setType] = useState<'sale' | 'expense'>(defaultType)
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [partyId, setPartyId] = useState(searchParams.get('party') || '')
  const [newPartyName, setNewPartyName] = useState('')
  const [partySearchOpen, setPartySearchOpen] = useState(false)
  const [partySearchQuery, setPartySearchQuery] = useState('')
  
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Smart Defaults from LocalStorage
  useEffect(() => {
    const lastAccount = localStorage.getItem('last_account_id')
    if (lastAccount && accounts.some(a => a.id === lastAccount)) {
      setAccountId(lastAccount)
    } else if (accounts.length > 0) {
      setAccountId(accounts[0].id)
    }

    const lastCategory = localStorage.getItem(`last_category_${type}`)
    if (lastCategory) {
      setCategoryId(lastCategory)
    }

    amountInputRef.current?.focus()
  }, [type, accounts])

  const suggestedCategories = Array.from(new Set([
    ...(type === 'sale' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES),
    ...recentCategories
  ]))

  const filteredParties = parties.filter(p => p.type === (type === 'sale' ? 'customer' : 'supplier') || p.type === 'both')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const numAmount = Number(amount)
    if (!numAmount || numAmount <= 0) {
      setError('সঠিক পরিমাণ লিখুন')
      return
    }

    setLoading(true)
    setError('')

    localStorage.setItem('last_account_id', accountId)
    localStorage.setItem(`last_category_${type}`, categoryId)

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    const payload = {
      type,
      amount: numAmount,
      account_id: accountId,
      category: categoryId || undefined,
      party_id: partyId || undefined,
      new_party_name: newPartyName || undefined,
      notes: notes || undefined,
      idempotencyKey
    }

    try {
      if (!navigator.onLine) {
        throw new Error('OFFLINE')
      }

      const res = await createTransaction(payload)

      if (res.success) {
        setSuccess(true)
        setTimeout(() => {
          router.back()
        }, 1000)
      } else {
        setError(res.error || 'সংরক্ষণ করা যায়নি')
        setLoading(false)
      }
    } catch (err: any) {
      // If network fails (fetch error) or explicitly offline, queue it!
      const isNetworkError = err.message === 'OFFLINE' || err.message.includes('fetch') || err.message.includes('Network') || err.message.includes('Failed to fetch')
      
      if (isNetworkError) {
        // dynamic import so idb-keyval doesn't break SSR if used elsewhere
        const { addToOfflineQueue } = await import('@/lib/offline/queue')
        await addToOfflineQueue({
          id: idempotencyKey,
          idempotencyKey,
          type: 'transaction',
          payload
        })
        
        setSuccess(true)
        // Optionally show toast, but OfflineIndicator will pop up.
        setTimeout(() => {
          router.back()
        }, 1000)
      } else {
        setError('অপ্রত্যাশিত ত্রুটি ঘটেছে। আবার চেষ্টা করুন।')
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!loading && !success && amount) {
          handleSubmit(new Event('submit') as any)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, success, amount, accountId, categoryId, partyId, newPartyName, notes, type])

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle2 className="h-20 w-20 text-emerald-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900">সফলভাবে সংরক্ষিত!</h2>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
      <Tabs value={type} onValueChange={(v: any) => { 
        setType(v); 
        setCategoryId(''); 
        setPartyId(''); 
        setNewPartyName('');
        amountInputRef.current?.focus() 
      }}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sale" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white">আয় (Income)</TabsTrigger>
          <TabsTrigger value="expense" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">খরচ (Expense)</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="border-2 shadow-sm">
        <CardContent className="p-6 space-y-6">
          
          {/* Amount (Giant Input) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-500">পরিমাণ (৳)</Label>
            <Input 
              ref={amountInputRef}
              type="number" 
              inputMode="decimal"
              placeholder="0"
              required
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-5xl font-bold h-20 text-center tracking-tighter"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-500">পেমেন্ট মাধ্যম</Label>
            <div className="flex flex-wrap gap-2">
              {accounts.map(acc => (
                <Button
                  key={acc.id}
                  type="button"
                  variant={accountId === acc.id ? 'default' : 'outline'}
                  onClick={() => setAccountId(acc.id)}
                  className={`flex-1 min-w-[80px] ${accountId === acc.id ? (type === 'sale' ? 'bg-emerald-600' : 'bg-red-600') : ''}`}
                >
                  {acc.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-500">ক্যাটাগরি</Label>
            <Input 
              placeholder="ক্যাটাগরি লিখুন বা নির্বাচন করুন" 
              list="categories"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            />
            <datalist id="categories">
              {suggestedCategories.map((cat, idx) => (
                <option key={idx} value={cat} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-2 mt-2">
              {suggestedCategories.slice(0, 4).map((cat, idx) => (
                <span 
                  key={idx} 
                  onClick={() => setCategoryId(cat)}
                  className="text-xs bg-slate-100 px-2 py-1 rounded cursor-pointer hover:bg-slate-200"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Party (Optional) Combobox */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-500">
              {type === 'sale' ? 'কাস্টমার (অপশনাল)' : 'সাপ্লায়ার (অপশনাল)'}
            </Label>
            <Popover open={partySearchOpen} onOpenChange={setPartySearchOpen}>
              <PopoverTrigger
                role="combobox"
                aria-expanded={partySearchOpen}
                className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between font-normal")}
              >
                {partyId 
                  ? filteredParties.find(p => p.id === partyId)?.name
                  : newPartyName 
                    ? `${newPartyName} (নতুন তৈরি হবে)` 
                    : "-- নির্বাচন করুন --"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput 
                    placeholder="নাম দিয়ে খুঁজুন..." 
                    value={partySearchQuery}
                    onValueChange={setPartySearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {partySearchQuery ? (
                        <div 
                          className="p-2 text-sm text-emerald-600 cursor-pointer hover:bg-slate-100 rounded-md"
                          onClick={() => {
                            setNewPartyName(partySearchQuery)
                            setPartyId('')
                            setPartySearchOpen(false)
                            setPartySearchQuery('')
                          }}
                        >
                          + "{partySearchQuery}" নতুন তৈরি করুন
                        </div>
                      ) : (
                        "কাউকে পাওয়া যায়নি"
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredParties.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => {
                            setPartyId(p.id)
                            setNewPartyName('')
                            setPartySearchOpen(false)
                            setPartySearchQuery('')
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              partyId === p.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {p.name} {p.phone ? `(${p.phone})` : ''}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-500">নোট (অপশনাল)</Label>
            <Textarea 
              placeholder="বিস্তারিত বিবরণ..." 
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
        </CardContent>
      </Card>

      <Button 
        type="submit" 
        disabled={loading} 
        className={`w-full h-14 text-lg font-bold shadow-lg ${type === 'sale' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
      >
        {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {loading ? 'সংরক্ষণ করা হচ্ছে...' : 'সংরক্ষণ করুন'}
      </Button>
      <p className="text-center text-xs text-slate-400 mt-2">কম্পিউটারে (Ctrl + Enter) চাপুন</p>
    </form>
  )
}
