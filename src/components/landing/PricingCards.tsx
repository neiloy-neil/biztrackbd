'use client'

import { useState } from 'react'
import { Check, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { startCheckoutIntent } from '@/domains/billing/actions/intent'

export function PricingCards({ plans }: { plans: any[] }) {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <section id="pricing" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            সহজ এবং সাশ্রয়ী প্রাইসিং
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            লুকানো কোনো চার্জ নেই। যেকোনো সময় ক্যানসেল করতে পারবেন।
          </p>

          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>মাসিক</span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-indigo-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAnnual ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? 'text-slate-900' : 'text-slate-500'}`}>
              বাৎসরিক <span className="text-emerald-600 ml-1">(সাশ্রয় করুন!)</span>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan: any) => {
            const isRecommended = plan.name.toLowerCase().includes('business') || plan.price_monthly === 500
            const currentPrice = isAnnual ? plan.price_yearly : plan.price_monthly
            
            // Calculate monthly equivalent if annual is selected and price_yearly exists
            const monthlyEquivalent = isAnnual && plan.price_yearly > 0 ? Math.round(plan.price_yearly / 12) : null
            
            return (
              <Card key={plan.id} className={`relative flex flex-col h-full ${isRecommended ? 'border-indigo-600 shadow-xl scale-105 z-10' : 'border-slate-200'}`}>
                {isRecommended && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full">
                    Recommended
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
                  <div className="mt-4 flex flex-col items-center justify-center">
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-4xl font-bold text-slate-900">৳{monthlyEquivalent || currentPrice}</span>
                      <span className="text-slate-500 mb-1">/মাস</span>
                    </div>
                    {isAnnual && plan.price_yearly > 0 && (
                      <div className="text-sm text-slate-500 mt-2">
                        বছরে ৳{plan.price_yearly} বিল করা হবে
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span className="text-slate-600">আনলিমিটেড এন্ট্রি</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span className="text-slate-600">ক্লাউড ব্যাকআপ</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span className="text-slate-600">কাস্টমার সাপোর্ট</span>
                    </li>
                    {plan.price_monthly > 0 && (
                      <>
                        <li className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                          <span className="text-slate-600 font-medium">একাধিক স্টাফ এক্সেস</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-indigo-500 shrink-0" />
                          <span className="text-slate-600 font-medium">অ্যাডভান্সড রিপোর্ট</span>
                        </li>
                      </>
                    )}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={() => startCheckoutIntent(plan.id, isAnnual ? 'annual' : 'monthly')}
                    className={`w-full ${isRecommended ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                  >
                    {plan.price_monthly === 0 ? 'ফ্রি শুরু করুন' : 'প্যাকেজটি বেছে নিন'}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
        
        <div className="mt-12 text-center flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Info className="w-4 h-4" />
          সমস্ত পেমেন্ট বিকাশ, নগদ বা কার্ডের মাধ্যমে করা যাবে।
        </div>
      </div>
    </section>
  )
}
