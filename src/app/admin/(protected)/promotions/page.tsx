import { getCoupons } from '@/domains/admin/promotions'
import { getPlans } from '@/domains/admin/actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlusCircle, Tag, Users, Clock, CheckCircle, XCircle } from 'lucide-react'
import CreateCouponForm from './create-coupon-form'
import ToggleCouponButton from './toggle-coupon-button'

export const metadata = {
  title: 'Promotions | Admin',
}

export default async function AdminPromotionsPage() {
  const [couponsResponse, plansResponse] = await Promise.all([
    getCoupons(),
    getPlans()
  ])

  const coupons = couponsResponse.success ? (couponsResponse.data as any[]) : []
  const plans = plansResponse.success ? (plansResponse.data as any[]) : []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Promotions & Coupons</h1>
          <p className="text-gray-500 mt-1">Manage discount codes, trials, and promotional credits.</p>
        </div>
        <CreateCouponForm plans={plans} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coupons.map((coupon: any) => (
          <Card key={coupon.id} className={coupon.is_active ? 'border-indigo-100' : 'opacity-75 bg-gray-50'}>
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <Badge variant={coupon.is_active ? 'default' : 'secondary'} className="mb-2">
                    {coupon.is_active ? 'Active' : 'Disabled'}
                  </Badge>
                  <CardTitle className="text-2xl font-black font-mono text-indigo-700 tracking-wider">
                    {coupon.code}
                  </CardTitle>
                </div>
                <ToggleCouponButton couponId={coupon.id} isActive={coupon.is_active} />
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Tag size={16} className="text-indigo-500" />
                <span className="font-semibold">
                  {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `${coupon.value} OFF`}
                </span>
                <span className="text-gray-400 text-sm">
                  ({coupon.duration === 'once' ? 'First Month' : coupon.duration === 'repeating' ? `${coupon.duration_in_months} Months` : 'Forever'})
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-700">
                <Users size={16} className="text-indigo-500" />
                <span className="text-sm">
                  {coupon.eligibility === 'new_only' ? 'New Customers Only' : 'All Customers'}
                </span>
              </div>

              {coupon.target_plan_id && (
                <div className="flex items-center gap-2 text-gray-700">
                  <CheckCircle size={16} className="text-indigo-500" />
                  <span className="text-sm">
                    Plan: <span className="font-medium">{coupon.plans?.name || 'Unknown'}</span>
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex justify-between text-sm">
                <div className="text-gray-500">
                  Uses: <span className="font-semibold text-gray-900">{coupon.redemptions_count}</span>
                  {coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ' (Unlimited)'}
                </div>
                <div className="text-gray-500">
                  {coupon.expires_at ? (
                    new Date(coupon.expires_at) < new Date() ? 
                      <span className="text-red-500 font-medium">Expired</span> : 
                      `Exp: ${new Date(coupon.expires_at).toLocaleDateString()}`
                  ) : 'No Expiry'}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {coupons.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
            <Tag size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-lg font-medium">No coupons created yet</p>
            <p className="text-sm">Click "Create Coupon" to start running promotions.</p>
          </div>
        )}
      </div>
    </div>
  )
}
