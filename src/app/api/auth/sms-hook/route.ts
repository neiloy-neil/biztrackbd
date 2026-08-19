import { NextResponse } from 'next/server'

import { sendSms } from '@/lib/sms/sender'
import { getPlatformSettingsCached } from '@/lib/settings'

export async function POST(req: Request) {
  try {
    const hookSecret = process.env.SUPABASE_HOOK_SECRET
    const authHeader = req.headers.get('Authorization')
    if (!hookSecret || authHeader !== `Bearer ${hookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await req.json()
    
    // Supabase Auth Send SMS Hook payload format
    // https://supabase.com/docs/guides/auth/auth-hooks#send-sms-hook
    const { user, sms } = payload
    const phone = user.phone
    const otp = sms.otp

    if (!phone || !otp) {
      return NextResponse.json({ error: 'Missing phone or OTP in payload' }, { status: 400 })
    }

    const settings = await getPlatformSettingsCached()
    const platformName = settings?.general?.platformName || 'BizTrack BD'
    
    // Prepare message
    const msg = `আপনার ${platformName} ওটিপি (OTP) কোড হল: ${otp}। কোডটি কারো সাথে শেয়ার করবেন না।`
    
    // Send SMS via sms.net.bd
    const smsResult = await sendSms(phone, msg)

    if (!smsResult.success) {
      console.error('SMS Gateway Error:', smsResult.error)
      return NextResponse.json({ error: smsResult.error }, { status: 500 })
    }

    // Supabase Auth expects a successful HTTP response to proceed
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to process SMS hook:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
