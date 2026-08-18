'use client'

import { ShieldCheck, Cloud, MapPin } from 'lucide-react'
import { motion } from 'framer-motion'

export function SocialProof() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  }

  return (
    <section className="py-12 border-b bg-white relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent opacity-50" />
      <div className="container mx-auto px-4 max-w-7xl">
        <p className="text-center text-sm font-semibold text-slate-500 tracking-wide uppercase mb-8">
          হাজারো বাংলাদেশি ব্যবসায়ীর বিশ্বস্ত সঙ্গী
        </p>
        <motion.div 
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16"
        >
          <motion.div variants={item} className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="font-bold text-slate-900">১০০% সুরক্ষিত</div>
              <div className="text-sm text-slate-500">আপনার ডাটা সম্পূর্ণ নিরাপদ</div>
            </div>
          </motion.div>
          <motion.div variants={item} className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Cloud className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="font-bold text-slate-900">অটোমেটিক ক্লাউড ব্যাকআপ</div>
              <div className="text-sm text-slate-500">ডাটা হারানোর ভয় নেই</div>
            </div>
          </motion.div>
          <motion.div variants={item} className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <div className="font-bold text-slate-900">মেড ইন বাংলাদেশ</div>
              <div className="text-sm text-slate-500">স্থানীয় ব্যবসার জন্য তৈরি</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
