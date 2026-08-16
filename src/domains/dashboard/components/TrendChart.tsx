'use client'

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'

export function TrendChart({ data }: { data: any[] }) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="h-[250px] w-full bg-slate-50 animate-pulse rounded-lg" />

  return (
    <Card className="shadow-sm mt-6">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold text-slate-800">বিক্রি ও খরচের ট্রেন্ড</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <div className="h-[250px] w-full text-xs">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} tickFormatter={(value) => `৳${value/1000}k`} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                itemStyle={{ fontSize: '12px', fontWeight: '500' }}
                formatter={(value: number) => [`৳${value}`, '']}
              />
              <Area type="monotone" dataKey="sales" name="বিক্রি" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
              <Area type="monotone" dataKey="expenses" name="খরচ" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExpenses)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
