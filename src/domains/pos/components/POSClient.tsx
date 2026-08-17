'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { processPOSSale, POSCartItem, POSPayment } from '@/domains/pos/actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Minus, Trash2, ShoppingCart, ArrowLeft, Printer, CheckCircle2, Loader2, User, Edit2, AlertCircle, RefreshCw, X } from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'
import { useOfflineSync } from '@/components/providers/OfflineSyncProvider'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type Product = any
type Account = any
type Customer = any

type CartItem = {
  product: Product
  quantity: number
  unit_price: number
  subtotal: number
}

export default function POSClient({ 
  initialProducts, 
  accounts, 
  customers 
}: { 
  initialProducts: Product[], 
  accounts: Account[], 
  customers: Customer[] 
}) {
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState<number>(0)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [receiptMode, setReceiptMode] = useState(false)
  const [lastTxnId, setLastTxnId] = useState('')
  const [showMobileCart, setShowMobileCart] = useState(false)
  const [editingItem, setEditingItem] = useState<CartItem | null>(null)
  // Checkout State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')

  // Offline sync hook
  const { isOnline, pendingCount, failedCount, isSyncing, retryFailed, clearFailed } = useOfflineSync()

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!search) return initialProducts
    const q = search.toLowerCase()
    return initialProducts.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.barcode && p.barcode.includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    )
  }, [search, initialProducts])

  // Cart Math
  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const cartTotal = Math.max(0, cartSubtotal - discount)
  
  // Payment Math
  const paidAmount = Number(paymentAmount) || 0
  const dueAmount = Math.max(0, cartTotal - paidAmount)
  const changeAmount = Math.max(0, paidAmount - cartTotal)

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        )
      }
      return [...prev, { product, quantity: 1, unit_price: Number(product.price), subtotal: Number(product.price) }]
    })
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQty, subtotal: newQty * item.unit_price }
      }
      return item
    }))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const saveItemEdit = (productId: string, newUnitPrice: number, newQuantity: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return {
          ...item,
          quantity: newQuantity,
          unit_price: newUnitPrice,
          subtotal: newQuantity * newUnitPrice
        }
      }
      return item
    }))
    setEditingItem(null)
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    setLoading(true)

    // Prepare payload — only product_id + quantity; prices are authoritative on the server
    const items: POSCartItem[] = cart.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity
    }))

    const payments: POSPayment[] = []
    if (paidAmount > 0 && selectedAccountId) {
      // If customer overpays, we only record up to cartTotal as payment, or record full and let them handle change?
      // Usually, revenue = cartTotal. So we record the exact payment received up to cartTotal, or full payment if keeping change.
      // We'll record exactly cartTotal if they gave more and we returned change.
      const actualPayment = paidAmount > cartTotal ? cartTotal : paidAmount
      payments.push({
        account_id: selectedAccountId,
        amount: actualPayment
      })
    }

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)
    
    const payload = {
      party_id: selectedCustomerId || undefined,
      discount,
      notes: 'POS Sale',
      items,
      payments,
      idempotencyKey
    }

    try {
      if (!navigator.onLine) {
        throw new Error('OFFLINE')
      }

      const res = await processPOSSale(payload)

      if (res.success) {
        setLastTxnId(res.data)
        setCheckoutOpen(false)
        setReceiptMode(true)
      } else {
        toast.error(res.error || 'Sale failed. Please try again.')
      }
    } catch (err: any) {
      const isNetworkError = err.message === 'OFFLINE' || err.message.includes('fetch') || err.message.includes('Network') || err.message.includes('Failed to fetch')
      
      if (isNetworkError) {
        const { addToOfflineQueue } = await import('@/lib/offline/queue')
        await addToOfflineQueue({
          id: idempotencyKey,
          idempotencyKey,
          type: 'pos_sale',
          payload
        })
        
        setLastTxnId(idempotencyKey)
        setCheckoutOpen(false)
        setReceiptMode(true)
      } else {
        toast.error('An unexpected error occurred.')
      }
    }
    setLoading(false)
  }

  const resetPOS = () => {
    setCart([])
    setDiscount(0)
    setSearch('')
    setSelectedCustomerId('')
    setPaymentAmount('')
    setSelectedAccountId('')
    setReceiptMode(false)
  }

  // Barcode Scanner effect (simplified)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault()
        if (cart.length > 0) setCheckoutOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart])

  if (receiptMode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-slate-100 print:bg-white print:p-0">
        <Card className="w-full max-w-sm bg-white shadow-xl print:hidden">
          <CardContent className="p-8 flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Sale Complete!</h2>
            <p className="text-slate-500 mb-8">Transaction has been recorded.</p>
            
            <div className="w-full space-y-4">
              <Button 
                onClick={() => window.print()} 
                className="w-full bg-slate-900 hover:bg-slate-800"
              >
                <Printer className="mr-2 w-4 h-4" /> Print Receipt
              </Button>
              <Button 
                onClick={resetPOS} 
                variant="outline" 
                className="w-full"
              >
                Next Sale (F2)
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Printable Area - Hidden on screen, visible on print */}
        <div className="hidden print:block w-[80mm] p-4 bg-white text-black font-mono text-sm absolute top-0 left-0">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold">BIZTRACK BD</h1>
            <p>Invoice: #{lastTxnId.split('-')[0]}</p>
            <p>Date: {new Date().toLocaleString()}</p>
          </div>
          <div className="border-t border-b border-dashed border-black py-2 mb-2">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1">{item.product.name}</td>
                    <td className="text-right py-1">{item.quantity}</td>
                    <td className="text-right py-1">{item.subtotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1 mb-4 text-right">
            <p>Subtotal: {cartSubtotal}</p>
            {discount > 0 && <p>Discount: -{discount}</p>}
            <p className="font-bold text-lg">Total: {cartTotal}</p>
          </div>
          <div className="text-center mt-8 border-t border-dashed border-black pt-2">
            <p>Thank you for your business!</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row w-full h-full bg-slate-50 relative overflow-hidden">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col h-full md:border-r border-slate-200 pb-16 md:pb-0">
        <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, SKU, or barcode (F2)..." 
              className="pl-10 h-12 text-lg bg-slate-100 border-none"
              autoFocus
            />
          </div>
        </div>

        {/* Offline Sync Indicator */}
        {!isOnline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center text-amber-700 font-medium">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              You are offline. Sales will be saved locally.
            </div>
          </div>
        )}
        {isOnline && pendingCount > 0 && (
          <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center text-indigo-700 font-medium">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isSyncing ? 'Syncing...' : `${pendingCount} offline sale${pendingCount !== 1 ? 's' : ''} pending sync`}
            </div>
          </div>
        )}
        {failedCount > 0 && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {failedCount} sale{failedCount !== 1 ? 's' : ''} failed to sync
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={retryFailed}
                className="flex items-center gap-1 text-rose-700 hover:text-rose-900 font-medium"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
              <button
                onClick={clearFailed}
                className="flex items-center gap-1 text-rose-500 hover:text-rose-700"
              >
                <X className="w-3 h-3" /> Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredProducts.map(p => (
              <button 
                key={p.id}
                onClick={() => addToCart(p)}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:border-[#007AFF] hover:shadow-md transition-all text-left flex flex-col active:scale-95"
              >
                <div className="aspect-square bg-slate-50 rounded-lg mb-3 flex items-center justify-center w-full">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-slate-300 font-bold text-2xl">{p.name.charAt(0)}</span>
                  )}
                </div>
                <div className="font-medium text-slate-900 line-clamp-2 leading-tight flex-1">{p.name}</div>
                <div className="text-[#007AFF] font-bold mt-2">৳{p.price}</div>
                <div className="text-xs text-slate-400 mt-1">Stock: {p.current_stock} {p.unit}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Cart Toggle Button */}
      <div className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-white border-t border-slate-200 z-10 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-500 uppercase">Cart ({cart.length})</span>
          <span className="text-lg font-bold text-slate-900">৳{cartTotal}</span>
        </div>
        <Button onClick={() => setShowMobileCart(true)} className="bg-[#007AFF] hover:bg-[#005bb5]">
          View Cart
        </Button>
      </div>

      {/* Right: Cart */}
      <div className={`w-full md:w-[400px] flex flex-col h-full bg-white shadow-xl z-20 shrink-0 fixed md:relative right-0 top-0 transition-transform duration-300 ${showMobileCart ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="p-4 bg-slate-900 text-white flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          <h2 className="font-bold text-lg">Current Sale</h2>
          <span className="ml-auto bg-white/20 px-2 py-0.5 rounded text-sm mr-2">{cart.length} items</span>
          <button onClick={() => setShowMobileCart(false)} className="md:hidden p-1 hover:bg-white/10 rounded">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900 line-clamp-1">{item.product.name}</h4>
                  <div className="text-sm text-slate-500">৳{item.unit_price}</div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.product.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-medium">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, 1)} className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="text-right w-16">
                  <div className="font-bold text-slate-900">৳{item.subtotal}</div>
                </div>

                <div className="flex flex-col gap-1 ml-1">
                  <button onClick={() => setEditingItem(item)} className="text-slate-400 hover:text-slate-600 p-1">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-rose-400 hover:text-rose-600 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Subtotal</span>
            <span>৳{cartSubtotal}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-slate-500">
            <span>Discount</span>
            <div className="flex items-center gap-1">
              <span>-৳</span>
              <Input 
                type="number" 
                value={discount || ''} 
                onChange={e => setDiscount(Number(e.target.value))} 
                className="w-20 h-7 text-right text-sm"
              />
            </div>
          </div>
          <div className="flex justify-between text-2xl font-bold text-slate-900 pt-2 border-t border-slate-200">
            <span>Total</span>
            <span>৳{cartTotal}</span>
          </div>

          <Button 
            onClick={() => setCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="w-full h-14 text-lg font-bold bg-[#007AFF] hover:bg-[#005bb5]"
          >
            Pay ৳{cartTotal} (F9)
          </Button>
        </div>
      </div>

      {/* Edit Item Modal */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        {editingItem && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Edit Item: {editingItem.product.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Unit Price (৳)</Label>
                <Input 
                  type="number" 
                  value={editingItem.unit_price} 
                  onChange={e => setEditingItem({ ...editingItem, unit_price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input 
                  type="number" 
                  value={editingItem.quantity} 
                  onChange={e => setEditingItem({ ...editingItem, quantity: Math.max(1, Number(e.target.value)) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
              <Button 
                onClick={() => saveItemEdit(editingItem.product.id, editingItem.unit_price, editingItem.quantity)}
                className="bg-[#007AFF] hover:bg-[#005bb5]"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Complete Sale</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto px-1">
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-sm text-slate-500 mb-1">Total Amount</p>
              <h2 className="text-4xl font-bold text-slate-900">৳{cartTotal}</h2>
            </div>

            <div className="space-y-3">
              <Label>Customer (Optional)</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]"
                >
                  <option value="">Walk-in Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setSelectedAccountId(acc.id)
                      if (!paymentAmount) setPaymentAmount(cartTotal.toString())
                    }}
                    className={`p-3 text-sm font-medium rounded-lg border transition-all ${
                      selectedAccountId === acc.id 
                        ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]' 
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedAccountId && (
              <div className="space-y-3">
                <Label>Amount Received</Label>
                <Input 
                  type="number" 
                  autoFocus
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="h-12 text-lg font-bold"
                  placeholder="0.00"
                />
                
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg text-sm mt-2">
                  <div className="flex flex-col">
                    <span className="text-slate-500">Change</span>
                    <span className="font-bold text-emerald-600">৳{changeAmount}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-slate-500">Due</span>
                    <span className="font-bold text-rose-600">৳{dueAmount}</span>
                  </div>
                </div>
                {dueAmount > 0 && !selectedCustomerId && (
                  <p className="text-xs text-rose-500 font-medium">⚠️ A customer must be selected to record due balance.</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              disabled={loading || (dueAmount > 0 && !selectedCustomerId)} 
              onClick={handleCheckout} 
              className="w-full h-12 text-lg bg-[#007AFF] hover:bg-[#005bb5]"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
