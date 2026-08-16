import { headers } from 'next/headers'

// In-memory store for rate limiting (Prototype only)
// Note: In a production serverless environment (Vercel) or distributed setup,
// this MUST be replaced by Redis (e.g., Upstash) because memory is not shared across instances.
const rateLimitCache = new Map<string, { count: number; expiresAt: number }>()

const WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS = 200 // Increased for development

/**
 * Basic rate limiter for Next.js Server Actions
 * Returns true if the request should be blocked.
 */
export async function rateLimit(actionName: string): Promise<boolean> {
  const headersList = await headers()
  // Try to get IP from standard proxy headers, fallback to a global bucket if undefined
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown-ip'
  
  const key = `ratelimit:${actionName}:${ip}`
  const now = Date.now()
  
  const record = rateLimitCache.get(key)
  
  if (!record || now > record.expiresAt) {
    rateLimitCache.set(key, { count: 1, expiresAt: now + WINDOW_MS })
    return false
  }
  
  if (record.count >= MAX_REQUESTS) {
    return true // Blocked
  }
  
  record.count += 1
  return false
}
