'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Package, Menu, Plus, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose, DrawerFooter } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'

import { useState } from 'react'

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  if (pathname === '/login' || pathname === '/pos') return null // Don't show on login/pos page

  return (
    <>
      <div className="pb-20" /> {/* Padding for the fixed bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background px-2 pb-safe md:hidden">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center space-y-1 ${pathname === '/dashboard' ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium">ড্যাশবোর্ড</span>
        </Link>
        <Link
          href="/parties"
          className={`flex flex-col items-center justify-center space-y-1 ${pathname === '/parties' ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px] font-medium">পার্টি</span>
        </Link>
        
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger className="relative -top-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95 transition-transform border-none outline-none">
            <Plus className="h-6 w-6" />
          </DrawerTrigger>
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm">
              <DrawerHeader>
                <DrawerTitle className="text-center text-xl font-bold">নতুন এন্ট্রি</DrawerTitle>
              </DrawerHeader>
              <div className="p-4 grid grid-cols-2 gap-4">
                <Link onClick={() => setOpen(false)} href="/pos" className="inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm transition-all outline-none select-none h-24 flex-col gap-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold active:scale-[0.98]">
                  <ArrowUpCircle className="h-8 w-8 text-emerald-600" />
                  <span className="text-lg">POS বিক্রি</span>
                </Link>
                <Link onClick={() => setOpen(false)} href="/transactions/new?type=sale" className="inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm transition-all outline-none select-none h-24 flex-col gap-2 border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold active:scale-[0.98]">
                  <ArrowUpCircle className="h-8 w-8 text-teal-600" />
                  <span className="text-lg">সাধারণ আয়</span>
                </Link>
                <Link onClick={() => setOpen(false)} href="/transactions/new?type=expense" className="inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm transition-all outline-none select-none h-24 flex-col gap-2 border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold active:scale-[0.98]">
                  <ArrowDownCircle className="h-8 w-8 text-rose-600" />
                  <span className="text-lg">খরচ</span>
                </Link>
                <Link onClick={() => setOpen(false)} href="/parties?tab=customers" className="inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm transition-all outline-none select-none h-24 flex-col gap-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold active:scale-[0.98]">
                  <Users className="h-8 w-8 text-blue-600" />
                  <span className="text-lg">পাওনা আদায়</span>
                </Link>
                <Link onClick={() => setOpen(false)} href="/parties?tab=suppliers" className="inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm transition-all outline-none select-none h-24 flex-col gap-2 border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold active:scale-[0.98]">
                  <Users className="h-8 w-8 text-orange-600" />
                  <span className="text-lg">দেনা পরিশোধ</span>
                </Link>
              </div>
              <DrawerFooter>
                <DrawerClose className="inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-100 hover:text-slate-900 w-full text-slate-600">
                  বাতিল করুন
                </DrawerClose>
              </DrawerFooter>
            </div>
          </DrawerContent>
        </Drawer>

        <Link
          href="/inventory"
          className={`flex flex-col items-center justify-center space-y-1 ${pathname === '/inventory' ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Package className="h-5 w-5" />
          <span className="text-[10px] font-medium">ইনভেন্টরি</span>
        </Link>
        <Link
          href="/settings"
          className={`flex flex-col items-center justify-center space-y-1 ${pathname === '/settings' ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">মেনু</span>
        </Link>
      </nav>
    </>
  )
}
