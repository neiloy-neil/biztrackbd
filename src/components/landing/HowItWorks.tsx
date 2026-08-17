export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            খুব সহজেই শুরু করুন
          </h2>
          <p className="text-lg text-slate-600">
            মাত্র তিনটি ধাপে আপনার ব্যবসাকে ডিজিটালাইজ করুন।
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line for desktop */}
          <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-0.5 bg-slate-100 -z-10" />

          <div className="relative text-center">
            <div className="w-24 h-24 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-indigo-100">
              <span className="text-3xl font-bold text-indigo-600">১</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">একাউন্ট খুলুন</h3>
            <p className="text-slate-600">আপনার মোবাইল নম্বর বা ইমেইল দিয়ে ১ মিনিটে ফ্রি একাউন্ট তৈরি করুন।</p>
          </div>

          <div className="relative text-center">
            <div className="w-24 h-24 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-indigo-100">
              <span className="text-3xl font-bold text-indigo-600">২</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">ব্যবসা যোগ করুন</h3>
            <p className="text-slate-600">আপনার দোকানের নাম ও তথ্য দিন। আপনি চাইলে একাধিক দোকান যোগ করতে পারবেন।</p>
          </div>

          <div className="relative text-center">
            <div className="w-24 h-24 mx-auto bg-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-indigo-100">
              <span className="text-3xl font-bold text-indigo-600">৩</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">হিসাব রাখা শুরু করুন</h3>
            <p className="text-slate-600">বেচাকেনা, খরচ এবং বাকি এন্ট্রি করা শুরু করুন। বাকি কাজ সিস্টেম নিজেই করবে।</p>
          </div>
        </div>
      </div>
    </section>
  )
}
