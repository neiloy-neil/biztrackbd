import Link from 'next/link'
import { LineChart } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                <LineChart className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">
                BizTrack<span className="text-indigo-400">BD</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400">
              বাংলাদেশের ছোট এবং মাঝারি ব্যবসার জন্য তৈরি একটি সহজ একাউন্টিং ও ম্যানেজমেন্ট সিস্টেম।
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">প্রোডাক্ট</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#features" className="hover:text-white transition-colors">ফিচার সমূহ</Link></li>
              <li><Link href="#pricing" className="hover:text-white transition-colors">প্রাইসিং</Link></li>
              <li><Link href="#how-it-works" className="hover:text-white transition-colors">কীভাবে কাজ করে</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">কোম্পানি</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">আমাদের সম্পর্কে</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">যোগাযোগ</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">প্রাইভেসি পলিসি</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">শর্তাবলী</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">যোগাযোগ</h4>
            <ul className="space-y-2 text-sm">
              <li>support@biztrackbd.com</li>
              <li>+880 1234 567890</li>
              <li>Dhaka, Bangladesh</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} BizTrack BD. All rights reserved.</p>
          <div className="flex items-center gap-2">
            Made with <span className="text-red-500">♥</span> in Bangladesh
          </div>
        </div>
      </div>
    </footer>
  )
}
