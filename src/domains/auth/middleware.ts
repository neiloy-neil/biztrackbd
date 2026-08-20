import { createClient } from '@/lib/supabase/server'

export function withAuth<T extends (...args: any[]) => any>(handler: T): T {
  return (async (...args: Parameters<T>) => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    return handler(...args)
  }) as T
}
