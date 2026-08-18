export function ProblemSolution() {
  return (
    <section className="py-24 bg-white border-t border-b overflow-hidden relative">
      <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-emerald-50 rounded-full blur-3xl opacity-50" />
      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              লাল খাতার দিন শেষ, <br />
              <span className="text-emerald-600">স্মার্ট ব্যবসার শুরু।</span>
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              সারাদিন বেচাকেনা করে রাতে খাতা-কলম নিয়ে হিসাব মেলাতে মেলাতে ক্লান্ত? 
              ভুল হিসাব, বাকি টাকা হারিয়ে যাওয়া বা স্টকে কত মাল আছে তা না জানার কারণে 
              প্রতি মাসে আপনার ব্যবসার যে ক্ষতি হচ্ছে, তা আজই বন্ধ করুন।
            </p>
            <ul className="space-y-4 pt-4">
              <li className="flex items-start bg-red-50 p-4 rounded-xl border border-red-100">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-200 flex items-center justify-center mr-4">
                  <span className="text-red-700 font-bold">✕</span>
                </div>
                <div>
                  <h4 className="font-bold text-red-900">খাতায় হিসাব রাখা ঝুঁকিপূর্ণ</h4>
                  <p className="text-red-700 text-sm mt-1">খাতা হারিয়ে গেলে বা নষ্ট হলে আপনার পাওনা টাকার কোনো প্রমাণ থাকে না।</p>
                </div>
              </li>
              <li className="flex items-start bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm shadow-emerald-100/50">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center mr-4">
                  <span className="text-emerald-700 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900">১০০% নিরাপদ ও সুরক্ষিত</h4>
                  <p className="text-emerald-700 text-sm mt-1">BizTrack BD তে আপনার সমস্ত ডেটা ক্লাউডে সেভ থাকে। যেকোনো সময় যেকোনো ডিভাইস থেকে এক্সেস করা যায়।</p>
                </div>
              </li>
            </ul>
          </div>
          
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="text-8xl font-serif text-white">"</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-medium mb-6 text-slate-100 leading-relaxed">
                "আগে কাস্টমার বাকির খাতা দেখতে চাইলে অনেক সময় লাগতো। এখন মোবাইল বের করেই সেকেন্ডের মধ্যে দেখিয়ে দেই। বাকি আদায় বেড়েছে প্রায় ৩০%।"
              </h3>
              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-slate-800">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center font-bold text-emerald-400 border border-emerald-500/30">
                  SA
                </div>
                <div>
                  <div className="font-semibold text-white">Sayed Alamin</div>
                  <div className="text-sm text-slate-400">Retail Shop Owner, Dhaka</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
