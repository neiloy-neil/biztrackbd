import { NextResponse } from 'next/server'

const SMS_API_KEY = process.env.SMS_NET_BD_API_KEY
const SMS_ENDPOINT = 'https://api.sms.net.bd/sendsms'

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

    if (!SMS_API_KEY) {
      console.error('SMS_NET_BD_API_KEY is not set in environment variables.')
      return NextResponse.json({ error: 'SMS configuration missing' }, { status: 500 })
    }

    // Prepare message
    const msg = `আপনার BizTrack BD ওটিপি (OTP) কোড হল: ${otp}। কোডটি কারো সাথে শেয়ার করবেন না।`
    
    // Send SMS via sms.net.bd
    // The API requires URL encoding for the msg parameter if sent via GET, 
    // but the docs specify we can use POST with form data.
    const formData = new URLSearchParams()
    formData.append('api_key', SMS_API_KEY)
    formData.append('msg', msg)
    formData.append('to', phone)

    const response = await fetch(SMS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    const responseData = await response.json()

    if (responseData.error !== 0) {
      console.error('SMS Gateway Error:', responseData)
      return NextResponse.json({ error: responseData.msg }, { status: 500 })
    }

    // Supabase Auth expects a successful HTTP response to proceed
    return NextResponse.json({ success: true, data: responseData })

  } catch (error) {
    console.error('Failed to process SMS hook:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
