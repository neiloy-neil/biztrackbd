'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createConsignment } from '@/domains/orders/courier-actions'
import { reconcileOrder } from '@/domains/orders/reconciliation-actions'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Package, ExternalLink, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { updateOrderStatus } from '@/domains/orders/actions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'


const stateColors: any = { pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800', shipped: 'bg-purple-100 text-purple-800', delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800' };
export function OrderList({ initialOrders, activeCouriers = [], accounts = [] }: { initialOrders: any[], activeCouriers?: string[], accounts?: any[] }) {
  const router = useRouter()
  const [orders, setOrders] = useState(initialOrders)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  
  // Reconciliation State
  const [reconcileOrder, setReconcileOrder] = useState<any>(null)
  const [reconcileAccount, setReconcileAccount] = useState<string>('')
  const [payoutAmount, setPayoutAmount] = useState<string>('')
  const [courierCharge, setCourierCharge] = useState<string>('')

  const handleStateChange = async (orderId: string, newState: string) => {
    setLoadingId(orderId)
    try {
      const res = await updateOrderStatus(orderId, newState)
      if (res.success) {
        setOrders(orders.map(o => o.id === orderId ? { ...o, state: newState } : o))
        toast.success(`Order marked as ${newState}`)
      } else {
        toast.error(res.error || 'Failed to update order status')
      }
    } catch (e) {
      toast.error('An unexpected error occurred')
    } finally {
      setLoadingId(null)
    }
  }

  const handleCreateShipment = async (orderId: string, provider: string) => {
    setLoadingId(orderId)
    try {
      const res = await createConsignment(orderId, provider)
      if (res.success) {
        toast.success(`Consignment created via ${provider}`)
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to create shipment')
      }
    } catch (e) {
      toast.error('An unexpected error occurred')
    } finally {
      setLoadingId(null)
    }
  }

  const handleReconcile = async () => {
    if (!reconcileOrder || !reconcileAccount || !payoutAmount) {
      toast.error('Please fill all required fields')
      return
    }

    const payout = parseFloat(payoutAmount)
    const charge = parseFloat(courierCharge || '0')
    const total = Number(reconcileOrder.total_amount)

    if (payout + charge !== total) {
      toast.error(`Amounts must sum to total (৳${total})`)
      return
    }

    setLoadingId(reconcileOrder.id)
    try {
      const { reconcileOrder: submitReconcile } = await import('@/domains/orders/reconciliation-actions')
      const res = await submitReconcile(reconcileOrder.id, reconcileAccount, payout, charge)
      if (res.success) {
        toast.success('Order reconciled successfully')
        setReconcileOrder(null)
        setOrders(orders.map(o => o.id === reconcileOrder.id ? { ...o, state: 'delivered' } : o))
      } else {
        toast.error(res.error || 'Failed to reconcile order')
      }
    } catch (e) {
      toast.error('An unexpected error occurred')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <Dialog open={!!reconcileOrder} onOpenChange={(open) => !open && setReconcileOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconcile COD Payout</DialogTitle>
          </DialogHeader>
          {reconcileOrder && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-3 rounded text-sm text-slate-700 flex justify-between font-medium">
                <span>Total Order Amount:</span>
                <span>৳{Number(reconcileOrder.total_amount).toLocaleString('en-IN')}</span>
              </div>
              
              <div className="space-y-2">
                <Label>Deposit Account</Label>
                <Select value={reconcileAccount} onValueChange={(val: any) => setReconcileAccount(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Bank/Wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Actual Payout Received (৳)</Label>
                <Input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder="e.g. 1425" />
              </div>

              <div className="space-y-2">
                <Label>Courier Delivery Fee (৳)</Label>
                <Input type="number" value={courierCharge} onChange={e => setCourierCharge(e.target.value)} placeholder="e.g. 75" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReconcileOrder(null)}>Cancel</Button>
            <Button onClick={handleReconcile} disabled={loadingId === reconcileOrder?.id}>Confirm Reconciliation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-sm">
            <th className="py-3 px-4 font-medium">Order Date</th>
            <th className="py-3 px-4 font-medium">Customer</th>
            <th className="py-3 px-4 font-medium">Address</th>
            <th className="py-3 px-4 font-medium text-right">Amount</th>
            <th className="py-3 px-4 font-medium text-center">Status</th>
            <th className="py-3 px-4 font-medium text-center">Courier</th>
            <th className="py-3 px-4 font-medium text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map(order => {
            const shipment = order.shipment?.[0]
            const hasCourier = !!shipment?.courier_consignment_id

            return (
              <tr key={order.id} className="hover:bg-slate-50">
                <td className="py-3 px-4">
                  <div className="text-sm font-medium text-slate-900">
                    {format(new Date(order.transaction_date), 'dd MMM, yyyy')}
                  </div>
                  <div className="text-xs text-slate-500">{order.id.slice(0, 8)}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm font-medium text-slate-900">{shipment?.customer_name || order.party?.name}</div>
                  <div className="text-xs text-slate-500">{shipment?.customer_phone || order.party?.phone}</div>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">
                  {shipment?.delivery_address}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="text-sm font-medium text-slate-900">
                    ৳{Number(order.total_amount).toLocaleString('en-IN')}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <Badge className={`${stateColors[order.state] || 'bg-slate-100'} font-normal`} variant="outline">
                    {order.state.toUpperCase()}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-center">
                  {hasCourier ? (
                    <div className="flex flex-col items-center space-y-1">
                      <Badge variant="secondary" className="text-[10px]">
                        ID: {shipment.courier_consignment_id}
                      </Badge>
                      {shipment.courier_tracking_link && (
                        <a href={shipment.courier_tracking_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center">
                          Track <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      )}
                    </div>
                  ) : order.state === 'pending' || order.state === 'processing' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="outline" size="sm" disabled={loadingId === order.id || activeCouriers.length === 0} className="h-8 text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          {activeCouriers.length === 0 ? 'No Courier' : 'Send to Courier'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {activeCouriers.map(c => (
                          <DropdownMenuItem key={c} onClick={() => handleCreateShipment(order.id, c)}>
                            Send via {c.charAt(0).toUpperCase() + c.slice(1)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {order.state === 'shipped' ? (
                    <Button 
                      size="sm" 
                      variant="default"
                      className="h-8 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        setReconcileOrder(order)
                        setPayoutAmount(order.total_amount)
                        setCourierCharge('0')
                      }}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Reconcile Payout
                    </Button>
                  ) : (
                    <Select
                      disabled={loadingId === order.id}
                      value={order.state}
                      onValueChange={(val) => handleStateChange(order.id, val)}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </td>
              </tr>
            )
          })}
          {orders.length === 0 && (
            <tr>
              <td colSpan={7} className="py-12 text-center text-slate-500">
                No online orders yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
