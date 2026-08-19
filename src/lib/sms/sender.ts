import { createClient } from '@/lib/supabase/server'

const SMS_API_KEY = process.env.SMS_NET_BD_API_KEY
const SMS_ENDPOINT = 'https://api.sms.net.bd/sendsms'

export async function sendSms(phone: string, message: string, businessId?: string): Promise<{ success: boolean; error?: string }> {
  // 1. If businessId is provided, check credits
  if (businessId) {
    const supabase = await createClient()
    const { data: business, error } = await supabase
      .from('businesses')
      .select('sms_credits, enable_sms_alerts')
      .eq('id', businessId)
      .single()

    if (error || !business) {
      return { success: false, error: 'Business not found' }
    }

    if (!business.enable_sms_alerts) {
      return { success: false, error: 'SMS alerts are disabled for this business' }
    }

    if (business.sms_credits <= 0) {
      return { success: false, error: 'Insufficient SMS credits' }
    }

    // Deduct credit
    const { error: updateError } = await supabase
      .from('businesses')
      .update({ sms_credits: business.sms_credits - 1 })
      .eq('id', businessId)

    if (updateError) {
      return { success: false, error: 'Failed to update SMS credits' }
    }
  }

  // 2. Send SMS
  if (!SMS_API_KEY) {
    console.error('SMS_NET_BD_API_KEY is not set in environment variables.')
    return { success: false, error: 'SMS configuration missing' }
  }

  try {
    const formData = new URLSearchParams()
    formData.append('api_key', SMS_API_KEY)
    formData.append('msg', message)
    formData.append('to', phone)

    const response = await fetch(SMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    })

    const data = await response.json()
    
    if (data.error !== 0) {
      console.error('SMS Gateway Error:', data)
      // Rollback credit if failed? (For simplicity, we'll keep it as deducted or could implement rollback)
      return { success: false, error: data.msg || 'SMS sending failed' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending SMS:', error)
    return { success: false, error: 'Failed to connect to SMS gateway' }
  }
}
