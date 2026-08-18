import { describe, it, expect, vi } from 'vitest'
import { authAction } from '../safe-action'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

// Mock the module itself
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}))

describe('safe-action.ts', () => {
  it('rejects unauthenticated users immediately', async () => {
    // Override the global mock for this specific test
    vi.mocked(createClient).mockReturnValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }
    } as any)

    const action = authAction(async () => {
      return { success: true, data: 'Should not execute' }
    })

    const result = await action({}, 'some-business-id')
    expect(result).toEqual({ success: false, error: 'Unauthorized: No active session' })
  })

  it('rejects users if no businessId is provided', async () => {
    // Override cookies to return null
    vi.mocked(cookies).mockResolvedValueOnce({
      get: vi.fn().mockReturnValue(undefined)
    } as any)

    // We mock member lookup to return null
    vi.mocked(createClient).mockReturnValueOnce({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
    } as any)

    const action = authAction(async () => {
      return { success: true, data: 'Should not execute' }
    })

    const result = await action({}) // No businessId provided
    expect(result).toEqual({ success: false, error: 'No active business selected' })
  })
})
