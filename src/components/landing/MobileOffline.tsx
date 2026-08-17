import { Smartphone, WifiOff } from 'lucide-react'

export function MobileOffline() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="bg-indigo-600 rounded-3xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-900/50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="grid md:grid-cols-2 items-center relative z-10">
            <div className="p-12 md:p-16 lg:p-24 text-white space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                ইন্টারনেট ছাড়াই চলবে!
              </h2>
              <p className="text-indigo-100 text-lg">
                মোবাইলে ডাটা নেই? ওয়াইফাই ডিসকানেক্ট? কোনো সমস্যা নেই। BizTrack BD অফলাইনেও কাজ করে। ইন্টারনেট কানেকশন পেলেই নিজে থেকে ডাটা সেভ হয়ে যাবে।
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-medium text-lg">১০০% মোবাইল ফ্রেন্ডলি</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <WifiOff className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-medium text-lg">অফলাইন সাপোর্ট</span>
                </div>
              </div>
            </div>
            
            <div className="hidden md:flex justify-end p-12 lg:pr-24 h-full relative">
              <div className="w-[280px] h-[580px] bg-white rounded-[3rem] border-[8px] border-slate-900 shadow-2xl rotate-12 absolute -bottom-24 -right-12 overflow-hidden flex items-center justify-center bg-slate-100">
                <div className="text-slate-400 font-mono text-sm text-center px-4">
                  [ Mobile App View Placeholder ]
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
