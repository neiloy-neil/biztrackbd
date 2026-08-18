'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, PlayCircle } from 'lucide-react'
import { motion } from 'framer-motion'

export function Hero() {
  return (
    <section className="relative pt-24 pb-32 overflow-hidden bg-slate-50">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <div className="container mx-auto px-4 relative z-10 max-w-7xl">
        <div className="text-center max-w-3xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
              দোকানের সমস্ত হিসাব,<br className="hidden md:block" /> এখন <span className="text-emerald-600">১০০% আপনার কন্ট্রোলে।</span>
            </h1>
          </motion.div>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto"
          >
            বাকি, নগদ, স্টক আর খরচের হিসাব নিয়ে আর কোনো দুশ্চিন্তা নয়। খাতা-কলমের ঝামেলা ছেড়ে দিন, আর রাতে নিশ্চিন্তে ঘুমান।
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center justify-center gap-4 pt-4"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
              <Link href="/app/onboarding" className="w-full sm:w-auto">
                <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg px-8 h-14 rounded-full font-bold shadow-lg shadow-emerald-600/20">
                  ফ্রি শুরু করুন (Start Free)
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="#how-it-works" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full text-lg px-8 h-14 rounded-full gap-2 bg-white">
                  <PlayCircle className="w-5 h-5 text-emerald-600" />
                  কীভাবে কাজ করে
                </Button>
              </Link>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              কোনো ক্রেডিট কার্ডের প্রয়োজন নেই • ১ মিনিটে একাউন্ট খুলুন
            </p>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-16 mx-auto max-w-5xl"
        >
          <div className="relative rounded-xl md:rounded-2xl border border-slate-200/50 bg-white/50 backdrop-blur-xl p-2 md:p-4 shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-100/50 to-transparent pointer-events-none" />
            <div className="aspect-[16/9] bg-slate-100 rounded-lg md:rounded-xl border border-slate-200 shadow-sm overflow-hidden relative flex items-center justify-center">
              <img 
                src="/app_mockup.jpg" 
                alt="BizTrack BD Mobile Dashboard UI" 
                className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity duration-500" 
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
