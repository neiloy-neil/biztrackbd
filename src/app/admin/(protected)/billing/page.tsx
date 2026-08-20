import { CreditCard, Check, X, Building, TrendingUp, Users, AlertCircle, RefreshCw, Activity, DollarSign } from 'lucide-react'
import { createAdminAuthClient } from '@/domains/auth/admin-actions'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SubscriptionActions } from '@/domains/admin/components/SubscriptionActions'

export default async function AdminBillingPage() {
  const supabase = await createAdminAuthClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: hasPermission } = await supabase.rpc('has_platform_permission', { required_permission: 'platform.billing.manage' })
  if (!hasPermission) redirect('/admin/dashboard')

  // Fetch all plans
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .order('price_monthly', { ascending: true })

  // Fetch all features for these plans
  const { data: features } = await supabase
    .from('plan_features')
    .select('*')

  // Fetch subscriptions with plan info and business name
  const { data: subs } = await supabase
    .from('subscriptions')
    .select(`
      id, status, current_period_end, plan_id, cancel_at_period_end,
      businesses ( id, name ),
      plans ( id, name, price_monthly )
    `)
    .order('current_period_end', { ascending: false })

  // Fetch payment operations
  const { data: operations } = await supabase
    .from('platform_payment_operations')
    .select(`
      id, provider, operation_type, amount, status, failure_reason, created_at,
      businesses ( name ),
      invoices ( id )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  const activeSubCounts = (subs || []).reduce((acc: Record<string, number>, sub) => {
    if (sub.status === 'active') {
      acc[sub.plan_id] = (acc[sub.plan_id] || 0) + 1
    }
    return acc
  }, {})

  const { data: metrics } = await supabase
    .from('admin_mrr_metrics')
    .select('*')
    .single()

  const mrr = metrics?.total_mrr || 0
  const arr = metrics?.total_arr || 0
  const activeCount = metrics?.active_subscriptions || 0
  const pastDueCount = metrics?.past_due_subscriptions || 0
  const cancelledCount = metrics?.canceled_subscriptions || 0
  const arpu = activeCount > 0 ? (mrr / activeCount).toFixed(2) : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-indigo-600" />
            SaaS Billing Operations
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage subscriptions, track MRR, and handle payment operations.</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="operations">Payment Ops</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Recurring Revenue (MRR)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">৳{mrr.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">ARR: ৳{arr.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeCount}</div>
                <p className="text-xs text-muted-foreground">ARPU: ৳{arpu}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Past Due</CardTitle>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pastDueCount}</div>
                <p className="text-xs text-muted-foreground">Requires attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Churned (Cancelled)</CardTitle>
                <Users className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cancelledCount}</div>
                <p className="text-xs text-muted-foreground">Total cancelled</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>All Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>MRR</TableHead>
                      <TableHead>Renewal Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subs?.map((sub: any) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.businesses?.name || 'Unknown'}</TableCell>
                        <TableCell>{sub.plans?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <Badge variant={sub.status === 'active' ? 'default' : sub.status === 'cancelled' ? 'destructive' : 'secondary'}>
                            {sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell>৳{sub.plans?.price_monthly || 0}</TableCell>
                        <TableCell>{new Date(sub.current_period_end).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <SubscriptionActions 
                            subscriptionId={sub.id} 
                            status={sub.status} 
                            cancelAtPeriodEnd={sub.cancel_at_period_end}
                            planId={sub.plan_id}
                            plans={plans || []}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!subs || subs.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No subscriptions found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations">
          <Card>
            <CardHeader>
              <CardTitle>Payment Operations & Webhooks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations?.map((op: any) => (
                      <TableRow key={op.id}>
                        <TableCell>{new Date(op.created_at).toLocaleString()}</TableCell>
                        <TableCell>{op.businesses?.name || 'Unknown'}</TableCell>
                        <TableCell className="capitalize">{op.operation_type}</TableCell>
                        <TableCell>৳{op.amount}</TableCell>
                        <TableCell>
                          <Badge variant={op.status === 'completed' ? 'default' : op.status === 'failed' ? 'destructive' : 'secondary'}>
                            {op.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="uppercase text-xs">{op.provider}</TableCell>
                      </TableRow>
                    ))}
                    {(!operations || operations.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No operations recorded yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mt-4">
            {plans?.map((plan) => {
              const planFeatures = features?.filter(f => f.plan_id === plan.id) || []

              const getLimit = (key: string) => {
                const f = planFeatures.find(pf => pf.feature_key === key)
                return f ? f.limit_value : 0
              }

              const formatLimit = (key: string) => {
                const val = getLimit(key)
                if (val === null) return 'Unlimited'
                if (val === 0) return 'None'
                return val
              }

              const hasFeature = (key: string) => {
                const val = getLimit(key)
                return val === null || val > 0
              }

              return (
                <div key={plan.id} className={`bg-white rounded-xl shadow-sm border ${!plan.is_active ? 'border-dashed border-gray-300 opacity-70' : 'border-gray-200'} overflow-hidden flex flex-col`}>
                  <div className="p-6 border-b border-gray-100 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      {!plan.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-gray-500 min-h-[40px]">{plan.description}</p>

                    <div className="mt-4 flex items-baseline text-3xl font-extrabold text-gray-900">
                      ৳{plan.price_monthly}
                      <span className="ml-1 text-sm font-medium text-gray-500">/mo</span>
                    </div>

                    <div className="mt-6 space-y-3">
                      <div className="text-sm font-medium text-gray-900 uppercase tracking-wider text-xs mb-2">Limits</div>
                      <ul className="space-y-3 text-sm text-gray-600">
                        <li className="flex justify-between"><span>Users</span> <span className="font-semibold">{formatLimit('max_users')}</span></li>
                        <li className="flex justify-between"><span>Branches</span> <span className="font-semibold">{formatLimit('max_branches')}</span></li>
                        <li className="flex justify-between"><span>Products</span> <span className="font-semibold">{formatLimit('max_products')}</span></li>
                        <li className="flex justify-between"><span>Transactions/mo</span> <span className="font-semibold">{formatLimit('transactions_per_month')}</span></li>
                      </ul>

                      <div className="text-sm font-medium text-gray-900 uppercase tracking-wider text-xs mt-6 mb-2">Features</div>
                      <ul className="space-y-3 text-sm text-gray-600">
                        <li className="flex items-center gap-2">
                          {hasFeature('inventory') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                          <span className={!hasFeature('inventory') ? 'text-gray-400 line-through' : ''}>Inventory</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {hasFeature('pos') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                          <span className={!hasFeature('pos') ? 'text-gray-400 line-through' : ''}>Point of Sale</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {hasFeature('reports') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                          <span className={!hasFeature('reports') ? 'text-gray-400 line-through' : ''}>Reports</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {hasFeature('staff_management') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                          <span className={!hasFeature('staff_management') ? 'text-gray-400 line-through' : ''}>Staff Management</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {hasFeature('multi_branch') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                          <span className={!hasFeature('multi_branch') ? 'text-gray-400 line-through' : ''}>Multi-Branch</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {hasFeature('ai_features') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                          <span className={!hasFeature('ai_features') ? 'text-gray-400 line-through' : ''}>AI Insights</span>
                        </li>
                        <li className="flex items-center gap-2">
                          {hasFeature('api_access') ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-gray-300" />}
                          <span className={!hasFeature('api_access') ? 'text-gray-400 line-through' : ''}>API Access</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                      <Building className="h-4 w-4 text-gray-400" />
                      {activeSubCounts[plan.id] || 0} active
                    </div>
                    <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
