import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'আমাদের সম্পর্কে – BizTrack BD' }

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-2xl w-full text-center space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">আমাদের সম্পর্কে</h1>
        <p className="text-lg text-slate-600">
          BizTrack BD হলো বাংলাদেশের ছোট ও মাঝারি ব্যবসার জন্য একটি সম্পূর্ণ বাংলা ব্যবসা ব্যবস্থাপনা সফটওয়্যার।
          বিক্রয়, খরচ, বাকি হিসাব, ইনভেন্টরি এবং রিপোর্ট — সব এক জায়গায়।
        </p>
        <p className="text-slate-500">
          আমাদের লক্ষ্য হলো প্রযুক্তির সুবিধা বাংলাদেশের প্রতিটি ব্যবসায়ীর হাতের মুঠোয় পৌঁছে দেওয়া।
        </p>
        <div className="pt-4">
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
