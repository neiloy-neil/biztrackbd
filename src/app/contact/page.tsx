import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail, Phone } from 'lucide-react'

export const metadata = { title: 'যোগাযোগ – BizTrack BD' }

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">যোগাযোগ করুন</h1>
        <p className="text-lg text-slate-600">
          কোনো প্রশ্ন বা সাহায্যের প্রয়োজন হলে আমাদের সাথে যোগাযোগ করুন।
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <a
            href="mailto:support@biztrackbd.com"
            className="flex items-center gap-2 justify-center px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Mail className="w-5 h-5 text-emerald-600" />
            support@biztrackbd.com
          </a>
          <a
            href="tel:+8801XXXXXXXXX"
            className="flex items-center gap-2 justify-center px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Phone className="w-5 h-5 text-emerald-600" />
            +880 1X-XXXX-XXXX
          </a>
        </div>
        <div className="pt-2">
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              হোমে ফিরুন
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
