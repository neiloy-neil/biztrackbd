'use client'

import { Activity, Building2, CreditCard, TrendingUp, Users, AlertTriangle } from 'lucide-react'

interface PlatformMetricsGridProps {
  metrics: {
    total_businesses: number
    active_businesses: number
    new_businesses_today: number
    new_businesses_month: number
    mrr: number
    arr: number
    paid_subscriptions: number
    free_subscriptions: number
    trial_subscriptions: number
    failed_payments: number
    total_transactions: number
    transactions_today: number
    transactions_month: number
  } | null
}

export function PlatformMetricsGrid({ metrics }: PlatformMetricsGridProps) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse h-32" />
        ))}
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  return (
    <div className="space-y-8">
      {/* Revenue Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-500" />
          Revenue & Billing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Monthly Recurring Revenue (MRR)</div>
            <div className="text-3xl font-bold text-gray-900">{formatCurrency(metrics.mrr)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Annual Run Rate (ARR)</div>
            <div className="text-3xl font-bold text-gray-900">{formatCurrency(metrics.arr)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Paid Subscriptions</div>
            <div className="text-3xl font-bold text-gray-900">{formatNumber(metrics.paid_subscriptions)}</div>
            <div className="text-xs text-gray-400 mt-1">
              + {formatNumber(metrics.trial_subscriptions)} on trial, {formatNumber(metrics.free_subscriptions)} free
            </div>
          </div>
          <div className="bg-red-50 rounded-xl shadow-sm border border-red-100 p-5">
            <div className="text-sm font-medium text-red-600 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Failed Payments
            </div>
            <div className="text-3xl font-bold text-red-700">{formatNumber(metrics.failed_payments)}</div>
          </div>
        </div>
      </section>

      {/* Business Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-500" />
          Business Growth
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Total Businesses</div>
            <div className="text-3xl font-bold text-gray-900">{formatNumber(metrics.total_businesses)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Active Businesses (30d)</div>
            <div className="text-3xl font-bold text-gray-900">{formatNumber(metrics.active_businesses)}</div>
            <div className="text-xs text-gray-400 mt-1">
              {((metrics.active_businesses / Math.max(metrics.total_businesses, 1)) * 100).toFixed(1)}% activity rate
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">New Businesses (This Month)</div>
            <div className="text-3xl font-bold text-gray-900">+{formatNumber(metrics.new_businesses_month)}</div>
            <div className="text-xs text-gray-400 mt-1">+{formatNumber(metrics.new_businesses_today)} today</div>
          </div>
        </div>
      </section>

      {/* Usage Section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          Platform Usage
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Total SaaS Transactions</div>
            <div className="text-3xl font-bold text-gray-900">{formatNumber(metrics.total_transactions)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Transactions (This Month)</div>
            <div className="text-3xl font-bold text-gray-900">{formatNumber(metrics.transactions_month)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500 mb-1">Transactions Today</div>
            <div className="text-3xl font-bold text-gray-900">{formatNumber(metrics.transactions_today)}</div>
          </div>
        </div>
      </section>
    </div>
  )
}
