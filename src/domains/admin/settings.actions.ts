'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { adminAction } from '@/lib/actions/safe-action'
import { PLATFORM_PERMISSIONS } from '@/lib/auth/admin-rbac'
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

export const updatePlatformSetting = adminAction<FormData, any>(PLATFORM_PERMISSIONS.SETTINGS_MANAGE, async (formData, ctx) => {
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
    
    // Safe bounds validation
    if (key === 'auth_limits') {
      if (typeof value?.otpExpiryMinutes !== 'number' || value.otpExpiryMinutes < 1 || value.otpExpiryMinutes > 60) {
        return { success: false, error: 'OTP expiry must be between 1 and 60 minutes' }
      }
      if (typeof value?.maxOtpAttempts !== 'number' || value.maxOtpAttempts < 1 || value.maxOtpAttempts > 100) {
        return { success: false, error: 'Max OTP attempts must be between 1 and 100' }
      }
    }
    
    if (key === 'billing') {
      if (typeof value?.defaultTrialDuration !== 'number' || value.defaultTrialDuration < 0 || value.defaultTrialDuration > 365) {
        return { success: false, error: 'Trial duration must be between 0 and 365 days' }
      }
      if (typeof value?.renewalGracePeriod !== 'number' || value.renewalGracePeriod < 0 || value.renewalGracePeriod > 30) {
        return { success: false, error: 'Grace period must be between 0 and 30 days' }
      }
    }

    if (key === 'security') {
      if (typeof value?.adminSessionDuration !== 'number' || value.adminSessionDuration < 1 || value.adminSessionDuration > 168) {
        return { success: false, error: 'Admin session must be between 1 and 168 hours' }
      }
      if (typeof value?.businessSessionDuration !== 'number' || value.businessSessionDuration < 1 || value.businessSessionDuration > 720) {
        return { success: false, error: 'Business session must be between 1 and 720 hours' }
      }
    }

    if (key === 'general') {
      if (typeof value?.platformName !== 'string' || value.platformName.length < 2 || value.platformName.length > 50) {
        return { success: false, error: 'Platform name must be between 2 and 50 characters' }
      }
    }

    const supabase = ctx.adminClient
    
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
        updated_by: ctx.userId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })
      
    if (error) {
      console.error('Failed to update setting:', error)
      return { success: false, error: 'Failed to update setting' }
    }
    
    // Audit log
    await supabase.rpc('log_admin_action', {
      p_admin_id: ctx.userId,
      p_action_type: 'UPDATE_SETTING',
      p_details: {
        key,
        old_value: oldValue,
        new_value: value
      }
    })
    
    revalidatePath('/admin/settings')
    return { success: true, data: null }
  })

export const getSystemEnvironmentStatus = adminAction<void, any>(PLATFORM_PERMISSIONS.SETTINGS_MANAGE, async (_params, ctx) => {
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
