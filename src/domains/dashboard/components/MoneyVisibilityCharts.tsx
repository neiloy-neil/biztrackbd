'use client'

import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

type ProfitDay = { date: string; profit: number }
type Closing   = { date: string; difference: number; actual_cash: number; expected_cash: number }

function shortDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('bn-BD', { weekday: 'short' })
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' })
}

export function ProfitSparkline({ data }: { data: ProfitDay[] }) {
  if (!data?.length) return null

  const chartData = data.map(d => ({
    day:    shortDay(d.date),
    profit: Number(d.profit),
  }))

  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 12 }}
            formatter={(v: unknown) => [`৳${Number(v).toLocaleString('en-IN')}`, 'লাভ']}
            labelFormatter={(l) => `${l}`}
          />
          <Bar dataKey="profit" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.profit > 0 ? '#10b981' : entry.profit < 0 ? '#f43f5e' : '#cbd5e1'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ClosingVarianceStrip({ closings }: { closings: Closing[] }) {
  if (!closings?.length) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {closings.map((c) => {
        const diff     = Number(c.difference)
        const absDiff  = Math.abs(diff)
        const isOk     = absDiff <= 200
        const isBad    = absDiff > 1000
        const label    = diff === 0 ? 'ঠিক' : diff > 0 ? `+৳${absDiff.toLocaleString('en-IN')}` : `-৳${absDiff.toLocaleString('en-IN')}`
        const bg       = isOk ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                       : isBad ? 'bg-rose-50 border-rose-200 text-rose-700'
                       : 'bg-amber-50 border-amber-200 text-amber-700'

        return (
          <div key={c.date} className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border text-center min-w-[56px] ${bg}`}>
            <span className="text-[10px] font-medium opacity-70">{shortDate(c.date)}</span>
            <span className="text-[11px] font-bold leading-tight">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
