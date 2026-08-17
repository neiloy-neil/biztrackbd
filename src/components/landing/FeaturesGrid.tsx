'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, TrendingUp, HandCoins, Package, Activity, Calculator } from 'lucide-react'

const features = [
  {
    icon: <Calculator className="w-8 h-8 text-indigo-600" />,
    title: 'বিক্রি ও খরচ হিসাব',
    description: 'প্রতিদিনের বেচাকেনা এবং খরচের হিসাব রাখুন খুব সহজেই। খাতা কলমের ঝামেলা আর নয়।'
  },
  {
    icon: <HandCoins className="w-8 h-8 text-rose-500" />,
    title: 'পাওনা ও দেনা',
    description: 'কার কাছে কত পাওনা আর কাকে কত দিতে হবে, সব রেকর্ড থাকুক এক জায়গায়।'
  },
  {
    icon: <Wallet className="w-8 h-8 text-emerald-500" />,
    title: 'ক্যাশ/বিকাশ/নগদ',
    description: 'দোকানের ক্যাশ বাক্স, বিকাশ বা নগদ একাউন্টে কত টাকা আছে, তার লাইভ ব্যালেন্স।'
  },
  {
    icon: <Package className="w-8 h-8 text-blue-500" />,
    title: 'ইনভেন্টরি',
    description: 'কোন প্রোডাক্ট কতগুলো আছে, কখন স্টক শেষ হবে, তার রিয়েল-টাইম আপডেট।'
  },
  {
    icon: <TrendingUp className="w-8 h-8 text-green-600" />,
    title: 'লাভ ও ক্ষতি',
    description: 'মাস শেষে বা দিন শেষে কত লাভ হলো, তা এক ক্লিকেই বের করুন।'
  },
  {
    icon: <Activity className="w-8 h-8 text-purple-500" />,
    title: 'অটোমেটিক রিপোর্ট',
    description: 'ডেইলি ক্লোজিং, মান্থলি রিপোর্ট সবই তৈরি হবে স্বয়ংক্রিয়ভাবে।'
  }
]

export function FeaturesGrid() {
  return (
    <section id="features" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            আপনার ব্যবসার সব হিসাব <br />এক প্ল্যাটফর্মে
          </h2>
          <p className="text-lg text-slate-600">
            একাউন্টিং এর জটিলতা ছাড়া, খুব সহজেই আপনার ব্যবসা ম্যানেজ করুন।
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <Card className="h-full border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl text-slate-900">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
