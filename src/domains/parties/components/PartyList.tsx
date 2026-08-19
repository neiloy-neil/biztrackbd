'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Phone, MessageCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getParties } from '@/domains/parties/actions'
import { useInView } from 'react-intersection-observer'
import { Loader2 } from 'lucide-react'

interface Party {
  id: string
  name: string
  phone: string | null
  type: string
  current_due: number
}

export function PartyList({ initialParties, currentType }: { initialParties: any[], currentType: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('type', value)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    // Basic debounce for search can be added here
    const params = new URLSearchParams(searchParams)
    if (e.target.value) {
      params.set('search', e.target.value)
    } else {
      params.delete('search')
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  const [parties, setParties] = useState<Party[]>(initialParties)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialParties.length === 50)
  
  const { ref, inView } = useInView()

  useEffect(() => {
    setParties(initialParties)
    setHasMore(initialParties.length === 50)
  }, [initialParties])

  const loadMore = async () => {
    if (loading || !hasMore) return
    setLoading(true)
    
    const lastParty = parties[parties.length - 1]
    const res = await getParties({ type: currentType as any, search, cursorDue: lastParty?.current_due, cursorId: lastParty?.id, limit: 50 })
    if (res?.success && res.data) {
      setParties(prev => [...prev, ...res.data])
      setHasMore(res.data.length === 50)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (inView) {
      loadMore()
    }
  }, [inView])

  const formatCurrency = (amount: number) => {
    const safe = isNaN(amount) ? 0 : Math.abs(amount)
    return '৳' + safe.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  }

  return (
    <div className="space-y-4">
      <Tabs value={currentType} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customer">কাস্টমার (Customer)</TabsTrigger>
          <TabsTrigger value="supplier">সাপ্লায়ার (Supplier)</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input 
          placeholder="নাম বা মোবাইল নাম্বার দিয়ে খুঁজুন..." 
          className="pl-9 bg-white" 
          value={search}
          onChange={handleSearch}
        />
      </div>

      <div className="space-y-3">
        {parties.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            কোনো তথ্য পাওয়া যায়নি
          </div>
        ) : (
          parties.map((party: Party) => (
            <Link key={party.id} href={`/parties/${party.id}`}>
              <Card className="hover:border-[#007AFF] transition-colors cursor-pointer mb-3">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{party.name}</h3>
                    <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" /> {party.phone || 'N/A'}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <div className={`font-bold ${party.current_due > 0 ? (party.type === 'customer' ? 'text-red-500' : 'text-orange-500') : 'text-emerald-500'}`}>
                        {formatCurrency(party.current_due)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {party.type === 'customer' 
                          ? (party.current_due >= 0 ? 'পাবো' : 'দিতে হবে') 
                          : (party.current_due >= 0 ? 'দিতে হবে' : 'পাবো')}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
      
      {hasMore && (
        <div ref={ref} className="text-center py-6 flex justify-center">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          ) : (
            <span className="text-sm text-slate-400">Loading more...</span>
          )}
        </div>
      )}
    </div>
  )
}
