import { NextRequest, NextResponse } from 'next/server'
import { getStorefrontProfileBySlug, submitOnlineOrder } from '@/domains/storefront/actions'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { slug, customerName, customerPhone, deliveryAddress, items, totalAmount, deliveryFee } = body

    if (!slug || !customerName || !customerPhone || !deliveryAddress || !items || !items.length) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Get businessId from slug
    const profileRes = await getStorefrontProfileBySlug(slug)
    if (!profileRes.success || !profileRes.data) {
      return NextResponse.json({ success: false, error: 'Storefront not found' }, { status: 404 })
    }
    
    const businessId = profileRes.data.business_id

    // 2. Submit Order
    const orderRes = await submitOnlineOrder({
      businessId,
      customerName,
      customerPhone,
      deliveryAddress,
      items,
      totalAmount,
      deliveryFee
    })

    if (!orderRes.success) {
      return NextResponse.json({ success: false, error: orderRes.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, transactionId: orderRes.transactionId })
  } catch (error: any) {
    console.error('Checkout API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
