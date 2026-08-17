import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function AnnouncementBar() {
  return (
    <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm font-medium">
      <Link href="/app/onboarding" className="flex items-center justify-center hover:underline">
        <span className="hidden md:inline">🎉 নতুন ফিচার: এখন অফলাইনেও ব্যবহার করুন BizTrack BD!</span>
        <span className="md:hidden">নতুন ফিচার: অফলাইন সাপোর্ট!</span>
        <ArrowRight className="ml-2 w-4 h-4" />
      </Link>
    </div>
  )
}
