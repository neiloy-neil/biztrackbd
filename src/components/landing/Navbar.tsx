import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LineChart } from 'lucide-react'

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <LineChart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">
              BizTrack<span className="text-indigo-600">BD</span>
            </span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <Link href="#features" className="hover:text-slate-900 transition-colors">ফিচার সমূহ</Link>
          <Link href="#how-it-works" className="hover:text-slate-900 transition-colors">কীভাবে কাজ করে</Link>
          <Link href="#pricing" className="hover:text-slate-900 transition-colors">প্যাকেজ</Link>
          <Link href="#faq" className="hover:text-slate-900 transition-colors">জিজ্ঞাসা (FAQ)</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">
            লগইন
          </Link>
          <Link href="/signup">
            <Button className="bg-indigo-600 hover:bg-indigo-700">ফ্রি শুরু করুন</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
