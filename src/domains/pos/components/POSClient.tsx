'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { processPOSSale, POSCartItem, POSPayment } from '@/domains/pos/actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, ArrowLeft,
  Printer, CheckCircle2, Loader2, User, Edit2, AlertCircle,
  RefreshCw, X, UserPlus,
} from 'lucide-react'
import { AppLink as Link } from '@/components/AppLink'
import { useOfflineSync } from '@/components/providers/OfflineSyncProvider'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

type Product = any
type Account = any
type Customer = any

type CartItem = {
  product: Product
  quantity: number
  unit_price: number
  subtotal: number
}

// 'due' means full credit — no cash account used
type CheckoutPaymentMode = 'due' | string // string = account_id

export default function POSClient({
  initialProducts,
  accounts,
  customers,
  businessName = 'BizTrack BD',
  businessPhone = '',
  businessAddress = '',
}: {
  initialProducts: Product[]
  accounts: Account[]
  customers: Customer[]
  businessName?: string
  businessPhone?: string
  businessAddress?: string
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

  // Checkout state
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [paymentMode, setPaymentMode] = useState<CheckoutPaymentMode>('')
  const [paymentAmount, setPaymentAmount] = useState('')
  // New customer inline creation
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  const { isOnline, pendingCount, failedCount, isSyncing, retryFailed, clearFailed } = useOfflineSync()

  const filteredProducts = useMemo(() => {
    if (!search) return initialProducts
    const q = search.toLowerCase()
    return initialProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    )
  }, [search, initialProducts])

  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const cartTotal = Math.max(0, cartSubtotal - discount)
  const isDueMode = paymentMode === 'due'
  const paidAmount = isDueMode ? 0 : (Number(paymentAmount) || 0)
  const dueAmount = Math.max(0, cartTotal - paidAmount)
  const changeAmount = Math.max(0, paidAmount - cartTotal)

  const hasCustomer = !!selectedCustomerId || (showNewCustomer && !!newCustomerName)

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
        return { ...item, quantity: newQuantity, unit_price: newUnitPrice, subtotal: newQuantity * newUnitPrice }
      }
      return item
    }))
    setEditingItem(null)
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (!paymentMode) { toast.error('পেমেন্ট মাধ্যম বেছে নিন'); return }
    if ((isDueMode || dueAmount > 0) && !hasCustomer) {
      toast.error('বাকির জন্য কাস্টমার নির্বাচন করুন')
      return
    }

    setLoading(true)

    const items: POSCartItem[] = cart.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
    }))

    const payments: POSPayment[] = []
    if (!isDueMode && paidAmount > 0 && paymentMode) {
      const actualPayment = Math.min(paidAmount, cartTotal)
      payments.push({ account_id: paymentMode, amount: actualPayment })
    }

    const idempotencyKey = crypto.randomUUID()
    const payload: any = {
      party_id: selectedCustomerId || undefined,
      new_party_name: showNewCustomer && newCustomerName ? newCustomerName : undefined,
      new_party_phone: showNewCustomer && newCustomerPhone ? newCustomerPhone : undefined,
      discount,
      notes: 'POS Sale',
      items,
      payments,
      idempotencyKey,
    }

    try {
      if (!navigator.onLine) throw new Error('OFFLINE')

      const res = await processPOSSale(payload)
      if (res.success) {
        setLastTxnId(res.data)
        setCheckoutOpen(false)
        setReceiptMode(true)
      } else {
        toast.error(res.error || 'বিক্রয় ব্যর্থ হয়েছে। আবার চেষ্টা করুন।')
      }
    } catch (err: any) {
      const isNetworkError =
        err.message === 'OFFLINE' ||
        err.message.includes('fetch') ||
        err.message.includes('Network') ||
        err.message.includes('Failed to fetch')

      if (isNetworkError) {
        const { addToOfflineQueue } = await import('@/lib/offline/queue')
        await addToOfflineQueue({ id: idempotencyKey, idempotencyKey, type: 'pos_sale', payload })
        setLastTxnId(idempotencyKey)
        setCheckoutOpen(false)
        setReceiptMode(true)
      } else {
        toast.error('অপ্রত্যাশিত ত্রুটি হয়েছে।')
      }
    }
    setLoading(false)
  }

  const resetPOS = () => {
    setCart([])
    setDiscount(0)
    setSearch('')
    setSelectedCustomerId('')
    setPaymentMode('')
    setPaymentAmount('')
    setShowNewCustomer(false)
    setNewCustomerName('')
    setNewCustomerPhone('')
    setReceiptMode(false)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') { e.preventDefault(); if (cart.length > 0) setCheckoutOpen(true) }
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
            <h2 className="text-2xl font-bold text-slate-900 mb-2">বিক্রয় সম্পন্ন!</h2>
            <p className="text-slate-500 mb-8">লেনদেন সংরক্ষিত হয়েছে।</p>
            <div className="w-full space-y-4">
              <Button onClick={() => window.print()} className="w-full bg-slate-900 hover:bg-slate-800">
                <Printer className="mr-2 w-4 h-4" /> রসিদ প্রিন্ট করুন
              </Button>
              <Button onClick={resetPOS} variant="outline" className="w-full">
                পরবর্তী বিক্রয় (F2)
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="hidden print:block w-[80mm] p-4 bg-white text-black font-mono text-sm absolute top-0 left-0">
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold">{businessName}</h1>
            {businessPhone && <p>{businessPhone}</p>}
            {businessAddress && <p>{businessAddress}</p>}
            <p className="mt-1">Invoice: #{lastTxnId.split('-')[0]}</p>
            <p>Date: {new Date().toLocaleString()}</p>
          </div>
          <div className="border-t border-b border-dashed border-black py-2 mb-2">
            <table className="w-full text-left">
              <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Total</th></tr></thead>
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
            <p>ধন্যবাদ!</p>
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
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="পণ্য খুঁজুন (নাম, SKU, বারকোড)..."
              className="pl-10 h-12 text-lg bg-slate-100 border-none"
              autoFocus
            />
          </div>
        </div>

        {!isOnline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center text-sm text-amber-700 font-medium">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            অফলাইন — বিক্রয় স্থানীয়ভাবে সংরক্ষিত হবে।
          </div>
        )}
        {isOnline && pendingCount > 0 && (
          <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2 flex items-center text-sm text-indigo-700 font-medium">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {isSyncing ? 'সিঙ্ক হচ্ছে...' : `${pendingCount}টি অফলাইন বিক্রয় সিঙ্কের অপেক্ষায়`}
          </div>
        )}
        {failedCount > 0 && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {failedCount}টি বিক্রয় সিঙ্ক ব্যর্থ হয়েছে
            </div>
            <div className="flex items-center gap-2">
              <button onClick={retryFailed} className="flex items-center gap-1 text-rose-700 hover:text-rose-900 font-medium">
                <RefreshCw className="w-3 h-3" /> পুনরায় চেষ্টা
              </button>
              <button onClick={clearFailed} className="flex items-center gap-1 text-rose-500 hover:text-rose-700">
                <X className="w-3 h-3" /> বাতিল
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
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                    : <span className="text-slate-300 font-bold text-2xl">{p.name.charAt(0)}</span>}
                </div>
                <div className="font-medium text-slate-900 line-clamp-2 leading-tight flex-1">{p.name}</div>
                <div className="text-[#007AFF] font-bold mt-2">৳{p.price}</div>
                <div className="text-xs text-slate-400 mt-1">Stock: {p.current_stock} {p.unit}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Cart Button */}
      <div className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-white border-t border-slate-200 z-10 flex justify-between items-center">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-500 uppercase">Cart ({cart.length})</span>
          <span className="text-lg font-bold text-slate-900">৳{cartTotal}</span>
        </div>
        <Button onClick={() => setShowMobileCart(true)} className="bg-[#007AFF] hover:bg-[#005bb5]">
          Cart দেখুন
        </Button>
      </div>

      {/* Right: Cart */}
      <div className={`w-full md:w-[400px] flex flex-col h-full bg-white shadow-xl z-20 shrink-0 fixed md:relative right-0 top-0 transition-transform duration-300 ${showMobileCart ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <div className="p-4 bg-slate-900 text-white flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          <h2 className="font-bold text-lg">বর্তমান বিক্রয়</h2>
          <span className="ml-auto bg-white/20 px-2 py-0.5 rounded text-sm mr-2">{cart.length} পণ্য</span>
          <button onClick={() => setShowMobileCart(false)} className="md:hidden p-1 hover:bg-white/10 rounded">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
              <p>কার্ট খালি</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900 line-clamp-1">{item.product.name}</h4>
                  <div className="text-sm text-slate-500">৳{item.unit_price}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.product.id, -1)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors">
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="w-8 text-center font-bold text-lg">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, 1)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors">
                    <Plus className="w-5 h-5" />
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
            <span>Subtotal</span><span>৳{cartSubtotal}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-slate-500">
            <span>ছাড়</span>
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
            <span>মোট</span><span>৳{cartTotal}</span>
          </div>
          <Button
            onClick={() => setCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="w-full h-14 text-lg font-bold bg-[#007AFF] hover:bg-[#005bb5]"
          >
            পেমেন্ট ৳{cartTotal} (F9)
          </Button>
        </div>
      </div>

      {/* Edit Item Modal */}
      <Dialog open={!!editingItem} onOpenChange={open => !open && setEditingItem(null)}>
        {editingItem && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">সম্পাদনা: {editingItem.product.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>একক মূল্য (৳)</Label>
                <Input type="number" value={editingItem.unit_price} onChange={e => setEditingItem({ ...editingItem, unit_price: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>পরিমাণ</Label>
                <Input type="number" value={editingItem.quantity} onChange={e => setEditingItem({ ...editingItem, quantity: Math.max(1, Number(e.target.value)) })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingItem(null)}>বাতিল</Button>
              <Button onClick={() => saveItemEdit(editingItem.product.id, editingItem.unit_price, editingItem.quantity)} className="bg-[#007AFF] hover:bg-[#005bb5]">
                সংরক্ষণ
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90dvh]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-2xl font-bold">বিক্রয় সম্পন্ন করুন</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 py-2 px-1 min-h-0">
            {/* Total */}
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-sm text-slate-500 mb-1">মোট পরিমাণ</p>
              <h2 className="text-4xl font-bold text-slate-900">৳{cartTotal}</h2>
            </div>

            {/* Customer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>কাস্টমার</Label>
                <button
                  type="button"
                  onClick={() => { setShowNewCustomer(v => !v); setSelectedCustomerId('') }}
                  className="text-xs text-[#007AFF] flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" />
                  {showNewCustomer ? 'বিদ্যমান বেছে নিন' : 'নতুন যোগ করুন'}
                </button>
              </div>

              {showNewCustomer ? (
                <div className="space-y-2">
                  <Input
                    placeholder="কাস্টমারের নাম"
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                  />
                  <Input
                    placeholder="ফোন নম্বর (যেমন: 01700000000)"
                    type="tel"
                    value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                  />
                </div>
              ) : (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={selectedCustomerId}
                    onChange={e => setSelectedCustomerId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]"
                  >
                    <option value="">ওয়াক-ইন কাস্টমার</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>পেমেন্ট মাধ্যম</Label>
              <div className="grid grid-cols-2 gap-2">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => { setPaymentMode(acc.id); if (!paymentAmount) setPaymentAmount(cartTotal.toString()) }}
                    className={`p-3 text-sm font-medium rounded-lg border transition-all ${
                      paymentMode === acc.id
                        ? 'border-[#007AFF] bg-blue-50 text-[#007AFF]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {acc.name}
                  </button>
                ))}
                {/* Due / Credit option — always full width for visual distinction */}
                <button
                  type="button"
                  onClick={() => { setPaymentMode('due'); setPaymentAmount('') }}
                  className={`p-3 text-sm font-medium rounded-lg border transition-all col-span-2 ${
                    isDueMode
                      ? 'border-orange-400 bg-orange-50 text-orange-600'
                      : 'border-orange-200 bg-white text-orange-500 hover:bg-orange-50'
                  }`}
                >
                  বাকি (Due)
                </button>
              </div>
              {isDueMode && (
                <p className="text-xs text-orange-600 font-medium">
                  সম্পূর্ণ বাকিতে — কোনো নগদ গণনা হবে না। কাস্টমারের বাকি ৳{cartTotal} বাড়বে।
                </p>
              )}
            </div>

            {/* Amount Received (only for cash/bkash modes) */}
            {!isDueMode && paymentMode && (
              <div className="space-y-2">
                <Label>প্রাপ্ত পরিমাণ</Label>
                <Input
                  type="number"
                  autoFocus
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="h-12 text-lg font-bold"
                  placeholder="0.00"
                />
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg text-sm">
                  <div className="flex flex-col">
                    <span className="text-slate-500">ফেরত</span>
                    <span className="font-bold text-emerald-600">৳{changeAmount}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-slate-500">বাকি</span>
                    <span className={`font-bold ${dueAmount > 0 ? 'text-rose-600' : 'text-slate-500'}`}>৳{dueAmount}</span>
                  </div>
                </div>
                {dueAmount > 0 && !hasCustomer && (
                  <p className="text-xs text-rose-500 font-medium">⚠️ বাকি রেকর্ড করতে কাস্টমার নির্বাচন করুন।</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              disabled={loading || !paymentMode || ((isDueMode || dueAmount > 0) && !hasCustomer)}
              onClick={handleCheckout}
              className={`w-full h-12 text-lg ${isDueMode ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#007AFF] hover:bg-[#005bb5]'}`}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDueMode ? 'বাকিতে বিক্রয় করুন' : 'পেমেন্ট নিশ্চিত করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
