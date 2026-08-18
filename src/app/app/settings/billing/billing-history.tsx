import { fetchInvoices, fetchCredits, fetchCouponRedemptions } from '@/domains/billing/actions'
import { Badge } from '@/components/ui/badge'
import { Receipt, CheckCircle2, Clock, XCircle, Gift, Tag } from 'lucide-react'

export async function BillingHistory({ businessId }: { businessId: string }) {
  // We can't use the direct action like this because authAction needs context, 
  // but Server Components don't have safe-action context automatically.
  // We should fetch directly here for a Server Component.
  
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, subscriptions(plans(name))')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  const { data: credits } = await supabase
    .from('promotional_credits')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  const { data: redemptions } = await supabase
    .from('coupon_redemptions')
    .select('*, coupons(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  const formatDate = (d: string) => new Date(d).toLocaleDateString()

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Paid</Badge>
      case 'open':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200">Open</Badge>
      case 'void':
      case 'uncollectible':
        return <Badge variant="secondary">Void</Badge>
      case 'draft':
      default:
        return <Badge variant="outline">Draft</Badge>
    }
  }

  return (
    <div className="space-y-8 mt-12">
      <div className="flex items-center gap-2 border-b pb-2 border-slate-200">
        <Receipt className="w-5 h-5 text-slate-700" />
        <h3 className="text-xl font-bold tracking-tight text-slate-900">Billing History</h3>
      </div>

      {/* Invoices & Payments */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h4 className="font-semibold text-slate-800">Invoices & Payments</h4>
        </div>
        <div className="divide-y divide-slate-100">
          {invoices && invoices.length > 0 ? (
            invoices.map((inv) => {
              const planName = inv.subscriptions?.plans ? (Array.isArray(inv.subscriptions.plans) ? inv.subscriptions.plans[0]?.name : (inv.subscriptions.plans as any).name) : 'Subscription'
              return (
                <div key={inv.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {inv.status === 'paid' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : inv.status === 'open' ? (
                        <Clock className="w-5 h-5 text-orange-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {planName} 
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatDate(inv.created_at)} • Invoice #{inv.id.split('-')[0]}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:min-w-[200px]">
                    <div className="text-right">
                      <p className="font-bold text-slate-900">৳{inv.amount_due}</p>
                      {inv.status === 'paid' && <p className="text-xs text-slate-500">Paid on {formatDate(inv.paid_date || inv.updated_at)}</p>}
                    </div>
                    <div>{getStatusBadge(inv.status)}</div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-6 text-center text-slate-500 text-sm">No invoices found.</div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Promotional Credits */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Gift className="w-4 h-4 text-slate-500" />
            <h4 className="font-semibold text-slate-800">Credits</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {credits && credits.length > 0 ? (
              credits.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{c.reason}</p>
                    <p className="text-xs text-slate-500">{formatDate(c.created_at)}</p>
                  </div>
                  <span className="font-semibold text-emerald-600">+৳{c.amount}</span>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-slate-500 text-sm">No credits applied.</div>
            )}
          </div>
        </div>

        {/* Applied Coupons */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Tag className="w-4 h-4 text-slate-500" />
            <h4 className="font-semibold text-slate-800">Coupons</h4>
          </div>
          <div className="divide-y divide-slate-100">
            {redemptions && redemptions.length > 0 ? (
              redemptions.map((r) => {
                const coupon = r.coupons as any
                if (!coupon) return null
                return (
                  <div key={r.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900 uppercase">{coupon.code}</p>
                      <p className="text-xs text-slate-500">Applied {formatDate(r.created_at)}</p>
                    </div>
                    <Badge variant="secondary">
                      {coupon.type === 'percentage' ? `${coupon.value}% off` : `৳${coupon.value} off`}
                    </Badge>
                  </div>
                )
              })
            ) : (
              <div className="p-4 text-center text-slate-500 text-sm">No coupons used.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
