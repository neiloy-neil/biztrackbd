import { ShieldCheck, Cloud, MapPin } from 'lucide-react'

export function SocialProof() {
  return (
    <section className="py-12 border-b bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        <p className="text-center text-sm font-semibold text-slate-500 tracking-wide uppercase mb-8">
          Trusted by small businesses across Bangladesh
        </p>
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-sm">
              <div className="font-bold text-slate-900">১০০% সুরক্ষিত</div>
              <div className="text-slate-500">আপনার ডাটা সম্পূর্ণ নিরাপদ</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm">
              <div className="font-bold text-slate-900">অটোমেটিক ক্লাউড ব্যাকআপ</div>
              <div className="text-slate-500">ডাটা হারানোর ভয় নেই</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-rose-600" />
            </div>
            <div className="text-sm">
              <div className="font-bold text-slate-900">মেড ইন বাংলাদেশ</div>
              <div className="text-slate-500">স্থানীয় ব্যবসার জন্য তৈরি</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
