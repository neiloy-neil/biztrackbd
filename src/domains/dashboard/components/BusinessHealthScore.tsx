'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp, DollarSign, Users } from 'lucide-react'
import { formatBanglaCurrency } from '@/lib/utils/bangla'

export function BusinessHealthScore({ data }: { data: any }) {
  if (!data) return null

  const { total_score, cash_flow, receivables, profitability } = data

  let overallColor = 'text-emerald-500'
  let overallBg = 'bg-emerald-50'
  let overallText = 'Excellent'
  
  if (total_score < 50) {
    overallColor = 'text-rose-500'
    overallBg = 'bg-rose-50'
    overallText = 'Critical'
  } else if (total_score < 80) {
    overallColor = 'text-amber-500'
    overallBg = 'bg-amber-50'
    overallText = 'Needs Attention'
  }

  const getStatusIcon = (score: number, max: number) => {
    if (score === max) return <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    if (score === 0) return <XCircle className="w-5 h-5 text-rose-500" />
    return <AlertTriangle className="w-5 h-5 text-amber-500" />
  }

  const getCashFlowStatus = () => {
    if (cash_flow.score === 40) return 'Positive cash flow. Your business is generating more cash than it spends.'
    if (cash_flow.score === 20) return 'Slightly negative cash flow, but manageable.'
    return 'Negative cash flow. High risk of cash shortage.'
  }

  const getReceivablesStatus = () => {
    if (receivables.score === 30) return 'Healthy collection rate. Dues are under control.'
    if (receivables.score === 15) return 'Moderate dues. Try to collect payments faster.'
    return 'High outstanding dues! Immediate collection efforts needed.'
  }

  const getProfitabilityStatus = () => {
    if (profitability.score === 30) return 'Excellent profit margins.'
    if (profitability.score === 15) return 'Moderate margins. Look for ways to reduce costs.'
    return 'Low or negative profit margins. Critical review of pricing and costs required.'
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
          <span>Business Health Score</span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${overallBg} ${overallColor}`}>
            {overallText}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-center gap-8">
          
          {/* Circular Score */}
          <div className="relative flex items-center justify-center w-32 h-32 shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-slate-100"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray="351.858"
                strokeDashoffset={351.858 - (351.858 * total_score) / 100}
                className={`transition-all duration-1000 ease-out ${overallColor}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-3xl font-black ${overallColor}`}>{total_score}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">/ 100</span>
            </div>
          </div>

          {/* Metrics Breakdown */}
          <div className="flex-1 space-y-4 w-full">
            <div className="flex gap-3 items-start">
              <div className="mt-0.5">{getStatusIcon(cash_flow.score, cash_flow.max)}</div>
              <div>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  Cash Flow 
                  <span className="text-xs font-normal text-slate-400">({cash_flow.score}/{cash_flow.max})</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{getCashFlowStatus()}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Net: ৳{formatBanglaCurrency(Math.abs(cash_flow.net))} {cash_flow.net < 0 ? '(Negative)' : ''}</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="mt-0.5">{getStatusIcon(receivables.score, receivables.max)}</div>
              <div>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  Receivables 
                  <span className="text-xs font-normal text-slate-400">({receivables.score}/{receivables.max})</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{getReceivablesStatus()}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Dues: ৳{formatBanglaCurrency(receivables.due)} ({(receivables.ratio * 100).toFixed(1)}% of Sales)</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="mt-0.5">{getStatusIcon(profitability.score, profitability.max)}</div>
              <div>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                  Profitability 
                  <span className="text-xs font-normal text-slate-400">({profitability.score}/{profitability.max})</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{getProfitabilityStatus()}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Margin: {(profitability.margin * 100).toFixed(1)}% (Net: ৳{formatBanglaCurrency(Math.abs(profitability.net_profit))} {profitability.net_profit < 0 ? 'Loss' : ''})</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
