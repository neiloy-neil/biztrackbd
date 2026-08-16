'use client'

import { useState, useEffect, ReactNode } from 'react'
import { getClientPermissions } from '@/lib/actions/permissions'

export function usePermissions() {
  const [role, setRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getClientPermissions().then(res => {
      if (mounted) {
        setRole(res.role)
        setPermissions(res.permissions)
        setLoading(false)
      }
    })
    return () => { mounted = false }
  }, [])

  const can = (permission: string) => {
    if (permissions.includes('*')) return true
    return permissions.includes(permission)
  }

  return { role, permissions, can, loading }
}

export function RequirePermission({ 
  permission, 
  children, 
  fallback = null 
}: { 
  permission: string
  children: ReactNode
  fallback?: ReactNode 
}) {
  const { can, loading } = usePermissions()

  if (loading) return null // Or a small skeleton
  
  if (!can(permission)) return fallback

  return <>{children}</>
}
