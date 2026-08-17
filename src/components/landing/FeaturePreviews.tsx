'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Users, Package, FileText } from 'lucide-react'

const previews = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
    description: 'Get a bird\'s eye view of your business health.',
    imageContent: '📊 Dashboard UI Preview'
  },
  {
    id: 'khata',
    title: 'Khata / Dues',
    icon: <Users className="w-5 h-5" />,
    description: 'Track customer balances and supplier payments effortlessly.',
    imageContent: '👥 Khata Ledger UI Preview'
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: <Package className="w-5 h-5" />,
    description: 'Real-time stock levels and low-stock alerts.',
    imageContent: '📦 Inventory Grid UI Preview'
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: <FileText className="w-5 h-5" />,
    description: 'Instant daily closing and profit/loss statements.',
    imageContent: '📑 Reports UI Preview'
  }
]

export function FeaturePreviews() {
  const [activeTab, setActiveTab] = useState(previews[0].id)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab(current => {
        const currentIndex = previews.findIndex(p => p.id === current)
        const nextIndex = (currentIndex + 1) % previews.length
        return previews[nextIndex].id
      })
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="py-24 bg-slate-900 text-white overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            পাওয়ারফুল ফিচার, সহজ ইন্টারফেস
          </h2>
          <p className="text-lg text-slate-400">
            Everything you need, nothing you don't. Designed specifically for Bangladeshi business owners.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-center">
          <div className="w-full lg:w-1/3 flex flex-col gap-2">
            {previews.map(preview => (
              <button
                key={preview.id}
                onClick={() => setActiveTab(preview.id)}
                className={`text-left p-6 rounded-xl transition-all duration-200 border ${
                  activeTab === preview.id 
                    ? 'bg-indigo-600/10 border-indigo-500 text-white' 
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`${activeTab === preview.id ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {preview.icon}
                  </div>
                  <h3 className="font-semibold text-lg">{preview.title}</h3>
                </div>
                <p className="text-sm opacity-80">{preview.description}</p>
              </button>
            ))}
          </div>

          <div className="w-full lg:w-2/3">
            <div className="relative aspect-[16/10] bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-center justify-center bg-slate-800"
                >
                  <div className="text-slate-500 font-mono flex flex-col items-center">
                    <div className="w-12 h-12 mb-4 rounded-full border-2 border-slate-600 border-t-indigo-500 animate-spin" />
                    [ {previews.find(p => p.id === activeTab)?.imageContent} ]
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
