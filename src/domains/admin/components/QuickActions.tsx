'use client'

import { Plus, Tag, Bell, ShieldAlert } from 'lucide-react'

export function QuickActions() {
  const actions = [
    {
      name: 'Create Plan',
      description: 'Define a new billing tier or modify existing ones',
      icon: Plus,
      color: 'bg-blue-50 text-blue-600',
      href: '/admin/billing/plans/new'
    },
    {
      name: 'Generate Coupon',
      description: 'Create discount codes for marketing campaigns',
      icon: Tag,
      color: 'bg-emerald-50 text-emerald-600',
      href: '/admin/billing/coupons/new'
    },
    {
      name: 'System Alert',
      description: 'Broadcast a maintenance or critical alert to all tenants',
      icon: Bell,
      color: 'bg-amber-50 text-amber-600',
      href: '/admin/settings/alerts/new'
    },
    {
      name: 'Failed Payments',
      description: 'Review and resolve stuck or failed invoice payments',
      icon: ShieldAlert,
      color: 'bg-red-50 text-red-600',
      href: '/admin/billing/invoices?status=failed'
    }
  ]

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => (
          <a
            key={action.name}
            href={action.href}
            className="flex flex-col bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-indigo-100 transition-all group"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${action.color}`}>
              <action.icon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {action.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
              {action.description}
            </p>
          </a>
        ))}
      </div>
    </div>
  )
}
