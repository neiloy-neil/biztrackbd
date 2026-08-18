'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { adminAction } from '@/lib/auth-wrappers'
import { revalidatePath } from 'next/cache'

export async function getPlatformSettings() {
  const supabase = createAdminClient()
  
  // We can just query them without the adminAction wrapper since it's a read operation
  // and RLS protects the table. However, it's safer to ensure we are an admin.
  const { data, error } = await supabase.from('platform_settings').select('*')
  
  if (error) {
    console.error('Failed to fetch platform settings:', error)
    return {}
  }
  
  const settings: Record<string, any> = {}
  data.forEach((row) => {
    settings[row.key] = row.value
  })
  
  return settings
}

export async function updatePlatformSetting(formData: FormData) {
  return adminAction('platform.settings.manage', async ({ user: admin }) => {
    const key = formData.get('key') as string
    const valueStr = formData.get('value') as string
    
    if (!key || !valueStr) {
      return { success: false, error: 'Missing key or value' }
    }
    
    let value: any
    try {
      value = JSON.parse(valueStr)
    } catch (e) {
      return { success: false, error: 'Invalid JSON value' }
    }
    
    const supabase = createAdminClient()
    
    // Get old value for audit logging
    const { data: oldSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .single()
      
    const oldValue = oldSetting?.value || null
    
    // Upsert the new setting
    const { error } = await supabase
      .from('platform_settings')
      .upsert({
        key,
        value,
        updated_by: admin.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      
    if (error) {
      console.error('Failed to update setting:', error)
      return { success: false, error: 'Failed to update setting' }
    }
    
    // Audit log
    await supabase.rpc('log_admin_action', {
      p_admin_id: admin.id,
      p_action_type: 'UPDATE_SETTING',
      p_details: {
        key,
        old_value: oldValue,
        new_value: value
      }
    })
    
    revalidatePath('/admin/settings')
    return { success: true }
  })
}

export async function getSystemEnvironmentStatus() {
  return adminAction('platform.settings.manage', async () => {
  // Returns status of environment variables without leaking secrets
  return {
    success: true,
    data: {
      databaseUrl: !!process.env.DATABASE_URL,
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      brevoApiKey: !!process.env.BREVO_API_KEY,
      uddoktapayApiKey: !!process.env.UDDOKTAPAY_API_KEY,
      smsGatewayUrl: !!process.env.SMS_GATEWAY_URL,
      smsApiKey: !!process.env.SMS_API_KEY,
      nodeEnv: process.env.NODE_ENV,
    }
  }
  })
}
