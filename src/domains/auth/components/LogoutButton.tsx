'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { logout } from '../actions'

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <Button 
      variant="destructive" 
      className="w-full"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          logout()
        })
      }}
    >
      <LogOut className="mr-2 h-4 w-4" /> {isPending ? 'লগ আউট হচ্ছে...' : 'লগ আউট (Log Out)'}
    </Button>
  )
}
